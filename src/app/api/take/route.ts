import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
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
import { ensureCredits } from "@/lib/credits";

export const maxDuration = 60;

async function getAuthContext(request: NextRequest) {
  const headerUserId = request.headers.get("x-user-id");
  const headerApiKeyId = request.headers.get("x-api-key-id");

  if (headerUserId) {
    return { userId: headerUserId, apiKeyId: headerApiKeyId };
  }

  try {
    const { userId } = await auth();
    return { userId, apiKeyId: null };
  } catch {
    return { userId: null, apiKeyId: null };
  }
}

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
  userId: string | undefined,
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
  ensureMeta?: { units?: number; mode?: "deducted" | "overage" }
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
    }).catch(() => {});
  }

  return publicUrl;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const rawParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawParams[key] = value;
    });

    const parsed = ScreenshotOptionsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const options = parsed.data;

    if (!options.url && !options.html && !options.markdown) {
      return NextResponse.json(
        { error: "Must provide url, html, or markdown parameter" },
        { status: 400 }
      );
    }

    const { userId, apiKeyId } = await getAuthContext(request);

    // ── Plan enforcement ─────────────────────────────────────────────
    let plan: PlanId = "free";
    let rateLimitInfo: { allowed: boolean; retryAfterMs: number; limit: number; remaining: number; reset: number } | null = null;
    if (userId) {
      plan = await getUserPlan(userId);

      rateLimitInfo = await checkRateLimit(userId, plan);
      if (!rateLimitInfo.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimitInfo.retryAfterMs / 1000)) } }
        );
      }

      if (!isFormatAllowed(options.format, plan)) {
        return NextResponse.json(
          { error: `Format "${options.format}" requires a paid plan. Upgrade at /dashboard/settings` },
          { status: 403 }
        );
      }
    }

    // Feature gating: force block settings per plan
    if (userId) {
      if (!isAdBlockingAllowed(plan)) options.block_ads = false;
      if (!isCookieBlockingAllowed(plan)) options.block_cookie_banners = false;
    }

    const cacheKey = getCacheKey(rawParams);
    const cached = await getFromCache(cacheKey);

    if (cached) {
      if (userId) {
        const ensure = await ensureCredits(userId, {
          cached: true,
          format: options.format,
          pdfPages: options.pdfPages,
          meterMetadata: { endpoint: "/api/take", method: "GET", cache: "hit" },
        });
        if (!ensure.allowed) {
          return NextResponse.json(
            { error: "No credits remaining. Upgrade or buy credits." },
            { status: 402 }
          );
        }
      }

      // Fire-and-forget: upload + save to DB in background
      uploadAndSave(
        userId ?? undefined,
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
        startTime
      ).catch(() => {});

      logRequest(userId ?? "anonymous", {
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
          ...(rateLimitInfo ? {
            "X-RateLimit-Limit": String(rateLimitInfo.limit),
            "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
            "X-RateLimit-Reset": String(rateLimitInfo.reset),
          } : {}),
        },
      });
    }

    // Deduct or meter credits before rendering (skip if unauthenticated)
    if (userId) {
      const ensure = await ensureCredits(userId, {
        cached: false,
        format: options.format,
        pdfPages: options.pdfPages,
        meterMetadata: { endpoint: "/api/take", method: "GET" },
      });
      if (!ensure.allowed) {
        return NextResponse.json(
          { error: "No credits remaining. Upgrade or buy credits." },
          { status: 402 }
        );
      }
    }

    const result = await render(options);

    // Fire-and-forget: upload + cache + save to DB in background
    uploadAndSave(
      userId ?? undefined,
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
      startTime
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

    logRequest(userId ?? "anonymous", {
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
        ...(rateLimitInfo ? {
          "X-RateLimit-Limit": String(rateLimitInfo.limit),
          "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
          "X-RateLimit-Reset": String(rateLimitInfo.reset),
        } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const parsed = ScreenshotOptionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const options = parsed.data;

    if (!options.url && !options.html && !options.markdown) {
      return NextResponse.json(
        { error: "Must provide url, html, or markdown parameter" },
        { status: 400 }
      );
    }

    const { userId, apiKeyId } = await getAuthContext(request);

    // ── Plan enforcement ─────────────────────────────────────────────
    let plan: PlanId = "free";
    let rateLimitInfo: { allowed: boolean; retryAfterMs: number; limit: number; remaining: number; reset: number } | null = null;
    if (userId) {
      plan = await getUserPlan(userId);

      rateLimitInfo = await checkRateLimit(userId, plan);
      if (!rateLimitInfo.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Try again later." },
          { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimitInfo.retryAfterMs / 1000)) } }
        );
      }

      if (!isFormatAllowed(options.format, plan)) {
        return NextResponse.json(
          { error: `Format "${options.format}" requires a paid plan. Upgrade at /dashboard/settings` },
          { status: 403 }
        );
      }

      if (!isAdBlockingAllowed(plan)) options.block_ads = false;
      if (!isCookieBlockingAllowed(plan)) options.block_cookie_banners = false;
    }

    // Check cache before rendering (POST handler)
    const cacheKey = getCacheKey(options as unknown as Record<string, unknown>);
    const cached = await getFromCache(cacheKey);

    if (cached) {
      const publicUrl: string | null = (cached.metadata.storageUrl as string) ?? null;

      if (userId) {
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
        }).catch(() => {});
      }

      logRequest(userId ?? "anonymous", {
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
          ...(rateLimitInfo ? {
            "X-RateLimit-Limit": String(rateLimitInfo.limit),
            "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
            "X-RateLimit-Reset": String(rateLimitInfo.reset),
          } : {}),
        },
      });
    }

    // Deduct or meter credits before rendering (skip if unauthenticated)
    if (userId) {
      const ensure = await ensureCredits(userId, {
        cached: false,
        format: options.format,
        pdfPages: options.pdfPages,
        meterMetadata: { endpoint: "/api/take", method: "POST" },
      });
      if (!ensure.allowed) {
        return NextResponse.json(
          { error: "No credits remaining. Upgrade or buy credits." },
          { status: 402 }
        );
      }
    }

    const result = await render(options);

    // Upload to R2 + save to DB (awaited for POST so we return the URL)
    let publicUrl: string | null = null;
    try {
      publicUrl = await uploadAndSave(
        userId ?? undefined,
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
        startTime
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

    logRequest(userId ?? "anonymous", {
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
        ...(rateLimitInfo ? {
          "X-RateLimit-Limit": String(rateLimitInfo.limit),
          "X-RateLimit-Remaining": String(rateLimitInfo.remaining),
          "X-RateLimit-Reset": String(rateLimitInfo.reset),
        } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
