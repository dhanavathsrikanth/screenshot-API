import { NextRequest, NextResponse } from "next/server";
import { ScreenshotOptionsSchema } from "@/lib/schema";
import { render } from "@/screenshot-engine/renderer";
import { uploadToStorage } from "@/screenshot-engine/uploader";
import { getCacheKey, getFromCache, setInCache } from "@/screenshot-engine/cache";
import { getFilename } from "@/lib/utils";
import { logScreenshotUsage } from "@/app/actions/usage";
import { saveScreenshot } from "@/app/actions/screenshots";
import { logRequest } from "@/lib/redis";
import {
  getUserPlan, checkRateLimit,
  isFormatAllowed, isAdBlockingAllowed, isCookieBlockingAllowed,
  type PlanId,
} from "@/lib/plans";
import { ensureCredits, refundCredits } from "@/lib/credits";
import { resolveAuth, type AuthContext } from "@/lib/api-auth";
import {
  featureUnavailable, getRequestId, insufficientCredits, internalError,
  missingTarget, normalizeUrl, rateLimited, rateLimitHeaders,
  unauthorized, zodErrorResponse,
} from "@/lib/api";

export const maxDuration = 60;

function uniqueKey(url: string, format: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const base = getFilename(url, format);
  return `${ts}_${rand}_${base}`;
}

/**
 * Upload to R2 + save to DB + log usage. Always uploads to R2 for all plans.
 * Returns the public URL after upload completes.
 */
async function uploadAndSave(
  userId: string,
  apiKeyId: string | undefined,
  buffer: Buffer,
  result: { format: string; width: number; height: number },
  options: {
    url?: string;
    method: string;
    cached: boolean;
    fullPage?: boolean;
    darkMode?: boolean;
    viewportWidth?: number;
    viewportHeight?: number;
    blockAds?: boolean;
    blockTrackers?: boolean;
    blockCookieBanners?: boolean;
    selector?: string;
    waitUntil?: string;
    quality?: number;
  },
  startTime: number,
  ensureMeta?: { units?: number; mode?: "deducted" | "overage" },
  source: "app" | "api" = "app"
): Promise<string | null> {
  const key = uniqueKey(options.url ?? "screenshot", result.format);
  const creditsMetadata =
    ensureMeta && typeof ensureMeta.units === "number"
      ? ({ credits_used: ensureMeta.units, mode: ensureMeta.mode ?? "deducted", cached: options.cached } as Record<string, unknown>)
      : ({ cached: options.cached } as Record<string, unknown>);

  let publicUrl: string | null = null;

  try {
    publicUrl = await uploadToStorage(buffer, key, `image/${result.format}`);
  } catch (e) {
    console.error("[uploadToStorage]", e instanceof Error ? e.message : e);
  }

  if (userId) {
    saveScreenshot({
      userId,
      apiKeyId: apiKeyId ?? undefined,
      sourceUrl: options.url,
      storageUrl: publicUrl,
      format: result.format,
      width: result.width,
      height: result.height,
      fileSizeBytes: buffer.length,
      cached: options.cached,
      metadata: {
        ...creditsMetadata,
        full_page: options.fullPage ?? false,
        dark_mode: options.darkMode ?? false,
        viewport_width: options.viewportWidth,
        viewport_height: options.viewportHeight,
        block_ads: options.blockAds ?? false,
        block_trackers: options.blockTrackers ?? false,
        block_cookie_banners: options.blockCookieBanners ?? false,
        selector: options.selector ?? null,
        wait_until: options.waitUntil ?? null,
        quality: options.quality ?? null,
        method: options.method,
        response_time_ms: Date.now() - startTime,
      },
    }).catch((e) => console.error("[saveScreenshot]", e.message));

    logScreenshotUsage({
      userId,
      apiKeyId: apiKeyId ?? undefined,
      endpoint: "/api/take",
      method: options.method,
      statusCode: 200,
      screenshotUrl: publicUrl,
      cached: options.cached,
      responseTimeMs: Date.now() - startTime,
      creditsUsed: ensureMeta?.units ?? 0,
      source,
    }).catch(() => {});
  }

  return publicUrl;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestId(request);
  try {
    const { searchParams } = new URL(request.url);
    const rawParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawParams[key] = value;
    });

    if (rawParams.url) rawParams.url = normalizeUrl(rawParams.url);

    const parsed = ScreenshotOptionsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error, requestId);
    }

    const options = parsed.data;

    if (!options.url && !options.html && !options.markdown) {
      return missingTarget(requestId);
    }

    const authCtx: AuthContext | null = await resolveAuth(request);
    if (!authCtx) return unauthorized(requestId);
    const { userId, apiKeyId } = authCtx;
    const source = authCtx.source;

    // ── Plan enforcement ─────────────────────────────────────────────
    const plan: PlanId = await getUserPlan(userId);

    const rateLimitInfo = await checkRateLimit(userId, plan);
    if (!rateLimitInfo.allowed) {
      return rateLimited(rateLimitInfo.retryAfterMs, rateLimitInfo, requestId);
    }

    if (!isFormatAllowed(options.format, plan)) {
      return featureUnavailable(`Format "${options.format}" requires a paid plan. Upgrade at /dashboard/plan`, requestId);
    }

    // Feature gating: force block settings per plan
    if (!isAdBlockingAllowed(plan)) options.block_ads = false;
    if (!isCookieBlockingAllowed(plan)) options.block_cookie_banners = false;

    const cacheKey = getCacheKey(rawParams);
    const cached = await getFromCache(cacheKey);

    if (cached) {
      const ensure = await ensureCredits(userId, {
        cached: true,
        format: options.format,
        pdfPages: options.pdfPages,
        meterMetadata: { endpoint: "/api/take", method: "GET", cache: "hit" },
      });
      if (!ensure.allowed) {
        return insufficientCredits(requestId);
      }

      // Fire-and-forget: upload + save to DB in background
      uploadAndSave(
        userId,
        apiKeyId ?? undefined,
        Buffer.from(cached.buffer),
        {
          format: cached.metadata.format as string,
          width: cached.metadata.width as number,
          height: cached.metadata.height as number,
        },
        {
          url: options.url,
          method: "GET",
          cached: true,
          fullPage: options.full_page,
          darkMode: options.dark_mode,
          viewportWidth: options.viewport_width,
          viewportHeight: options.viewport_height,
          blockAds: options.block_ads,
          blockTrackers: options.block_trackers,
          blockCookieBanners: options.block_cookie_banners,
          selector: options.selector,
          waitUntil: options.wait_until,
          quality: options.quality,
        },
        startTime,
        { units: ensure.units, mode: ensure.mode },
        source
      ).catch(() => {});

      logRequest(userId, {
        ts: new Date().toISOString(),
        endpoint: "/api/take",
        method: "GET",
        status: 200,
        ms: Date.now() - startTime,
        cached: true,
        url: options.url,
      }).catch(() => {});

      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          "Content-Type": `image/${options.format === "jpeg" ? "jpeg" : options.format}`,
          "Content-Length": cached.buffer.length.toString(),
          "X-Cache": "HIT",
          "X-Credits-Used": String(ensure.units),
          ...rateLimitHeaders(rateLimitInfo),
        },
      });
    }

    // Deduct or meter credits before rendering
    const ensure = await ensureCredits(userId, {
      cached: false,
      format: options.format,
      pdfPages: options.pdfPages,
      meterMetadata: { endpoint: "/api/take", method: "GET" },
    });
    if (!ensure.allowed) {
      return insufficientCredits(requestId);
    }

    let result: Awaited<ReturnType<typeof render>>;
    try {
      result = await render(options);
    } catch (error) {
      // Never charge for a render that failed — refund the deducted credits
      if (ensure.mode === "deducted") {
        await refundCredits(userId, ensure.units);
      }
      throw error;
    }

    // Fire-and-forget: upload + cache + save to DB in background
    uploadAndSave(
      userId,
      apiKeyId ?? undefined,
      result.buffer,
      { format: result.format, width: result.width, height: result.height },
      {
        url: options.url,
        method: "GET",
        cached: false,
        fullPage: options.full_page,
        darkMode: options.dark_mode,
        viewportWidth: options.viewport_width,
        viewportHeight: options.viewport_height,
        blockAds: options.block_ads,
        blockTrackers: options.block_trackers,
        blockCookieBanners: options.block_cookie_banners,
        selector: options.selector,
        waitUntil: options.wait_until,
        quality: options.quality,
      },
      startTime,
      { units: ensure.units, mode: ensure.mode },
      source
    ).then((publicUrl) => {
      // Update cache with storage URL after upload
      if (publicUrl) {
        setInCache(cacheKey, result.buffer, {
          width: result.width,
          height: result.height,
          format: result.format,
          storageUrl: publicUrl,
        }).catch(() => {});
      }
    }).catch(() => {});

    setInCache(cacheKey, result.buffer, {
      width: result.width,
      height: result.height,
      format: result.format,
      storageUrl: null,
    }).catch(() => {});

    logRequest(userId, {
      ts: new Date().toISOString(),
      endpoint: "/api/take",
      method: "GET",
      status: 200,
      ms: Date.now() - startTime,
      cached: false,
      url: options.url,
    }).catch(() => {});

    const ext = options.format === "jpeg" ? "jpg" : options.format;

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type":
          options.format === "pdf"
            ? "application/pdf"
            : `image/${options.format === "jpeg" ? "jpeg" : options.format}`,
        "Content-Length": result.buffer.length.toString(),
        "Content-Disposition": `inline; filename="${getFilename(options.url ?? "screenshot", ext)}"`,
        "X-Cache": "MISS",
        "X-Credits-Used": String(ensure.units),
        ...rateLimitHeaders(rateLimitInfo),
      },
    });
  } catch (error) {
    return internalError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestId(request);
  try {
    const body = await request.json();
    if (body && typeof body === "object" && typeof (body as Record<string, unknown>).url === "string") {
      (body as Record<string, unknown>).url = normalizeUrl((body as Record<string, unknown>).url as string);
    }
    const parsed = ScreenshotOptionsSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error, requestId);
    }

    const options = parsed.data;

    if (!options.url && !options.html && !options.markdown) {
      return missingTarget(requestId);
    }

    const authCtx: AuthContext | null = await resolveAuth(request);
    if (!authCtx) return unauthorized(requestId);
    const { userId, apiKeyId } = authCtx;
    const source = authCtx.source;

    // ── Plan enforcement ─────────────────────────────────────────────
    const plan: PlanId = await getUserPlan(userId);

    const rateLimitInfo = await checkRateLimit(userId, plan);
    if (!rateLimitInfo.allowed) {
      return rateLimited(rateLimitInfo.retryAfterMs, rateLimitInfo, requestId);
    }

    if (!isFormatAllowed(options.format, plan)) {
      return featureUnavailable(`Format "${options.format}" requires a paid plan. Upgrade at /dashboard/plan`, requestId);
    }

    if (!isAdBlockingAllowed(plan)) options.block_ads = false;
    if (!isCookieBlockingAllowed(plan)) options.block_cookie_banners = false;

    // Check cache before rendering (POST handler)
    const cacheKey = getCacheKey(options as unknown as Record<string, unknown>);
    const cached = await getFromCache(cacheKey);

    if (cached) {
      const publicUrl: string | null = (cached.metadata.storageUrl as string) ?? null;

      const ensure = await ensureCredits(userId, {
        cached: true,
        format: options.format,
        pdfPages: options.pdfPages,
        meterMetadata: { endpoint: "/api/take", method: "POST", cache: "hit" },
      });
      if (!ensure.allowed) {
        return insufficientCredits(requestId);
      }

      saveScreenshot({
        userId,
        apiKeyId: apiKeyId ?? undefined,
        sourceUrl: options.url,
        storageUrl: publicUrl,
        format: cached.metadata.format as string,
        width: cached.metadata.width as number,
        height: cached.metadata.height as number,
        fileSizeBytes: cached.buffer.length,
        cached: true,
        metadata: {
          credits_used: ensure.units,
          mode: ensure.mode,
          cached: true,
          full_page: options.full_page,
          dark_mode: options.dark_mode,
          viewport_width: options.viewport_width,
          viewport_height: options.viewport_height,
          block_ads: options.block_ads,
          block_trackers: options.block_trackers,
          block_cookie_banners: options.block_cookie_banners,
          selector: options.selector,
          wait_until: options.wait_until,
          quality: options.quality,
          method: "POST",
          response_time_ms: Date.now() - startTime,
        },
      }).catch((e) => console.error("[saveScreenshot]", e.message));

      logScreenshotUsage({
        userId,
        apiKeyId: apiKeyId ?? undefined,
        endpoint: "/api/take",
        method: "POST",
        statusCode: 200,
        screenshotUrl: publicUrl,
        cached: true,
        responseTimeMs: Date.now() - startTime,
        creditsUsed: ensure.units,
        source,
      }).catch(() => {});

      logRequest(userId, {
        ts: new Date().toISOString(),
        endpoint: "/api/take",
        method: "POST",
        status: 200,
        ms: Date.now() - startTime,
        cached: true,
        url: options.url,
      }).catch(() => {});

      return NextResponse.json({
        url: publicUrl,
        format: cached.metadata.format,
        width: cached.metadata.width,
        height: cached.metadata.height,
        size: cached.buffer.length,
        cached: true,
      }, {
        headers: {
          "X-Cache": "HIT",
          "X-Credits-Used": String(ensure.units),
          ...rateLimitHeaders(rateLimitInfo),
        },
      });
    }

    // Deduct or meter credits before rendering
    const ensure = await ensureCredits(userId, {
      cached: false,
      format: options.format,
      pdfPages: options.pdfPages,
      meterMetadata: { endpoint: "/api/take", method: "POST" },
    });
    if (!ensure.allowed) {
      return insufficientCredits(requestId);
    }

    let result: Awaited<ReturnType<typeof render>>;
    try {
      result = await render(options);
    } catch (error) {
      // Never charge for a render that failed — refund the deducted credits
      if (ensure.mode === "deducted") {
        await refundCredits(userId, ensure.units);
      }
      throw error;
    }

    // Upload to R2 + save to DB (awaited for POST so we return the URL)
    let publicUrl: string | null = null;
    try {
      publicUrl = await uploadAndSave(
        userId,
        apiKeyId ?? undefined,
        result.buffer,
        { format: result.format, width: result.width, height: result.height },
        {
          url: options.url,
          method: "POST",
          cached: false,
          fullPage: options.full_page,
          darkMode: options.dark_mode,
          viewportWidth: options.viewport_width,
          viewportHeight: options.viewport_height,
          blockAds: options.block_ads,
          blockTrackers: options.block_trackers,
          blockCookieBanners: options.block_cookie_banners,
          selector: options.selector,
          waitUntil: options.wait_until,
          quality: options.quality,
        },
        startTime,
        { units: ensure.units, mode: ensure.mode },
        source
      );
    } catch {
      // Upload failed — still return the format/dimensions
    }

    // Store in cache with the storage URL
    setInCache(cacheKey, result.buffer, {
      width: result.width,
      height: result.height,
      format: result.format,
      storageUrl: publicUrl,
    }).catch(() => {});

    logRequest(userId, {
      ts: new Date().toISOString(),
      endpoint: "/api/take",
      method: "POST",
      status: 200,
      ms: Date.now() - startTime,
      cached: false,
      url: options.url,
    }).catch(() => {});

    return NextResponse.json({
      url: publicUrl,
      format: result.format,
      width: result.width,
      height: result.height,
      size: result.buffer.length,
    }, {
      headers: {
        "X-Cache": "MISS",
        "X-Credits-Used": String(ensure.units),
        ...rateLimitHeaders(rateLimitInfo),
      },
    });
  } catch (error) {
    return internalError(error, requestId);
  }
}
