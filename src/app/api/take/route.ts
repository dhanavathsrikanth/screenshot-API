import { NextRequest, NextResponse } from "next/server";
import { ScreenshotOptionsSchema } from "@/lib/schema";
import { render } from "@/lib/browser/engine";
import { RenderError } from "@/lib/screenshot/types";
import { uploadToStorage } from "@/lib/storage/uploader";
import { getCacheKey, getFromCache, setInCache } from "@/lib/storage/cache";
import { artifactContentType } from "@/lib/mime";
import { getFilename } from "@/lib/utils";
import { logScreenshotUsage, ipHash } from "@/app/actions/usage";
import { saveScreenshot } from "@/app/actions/screenshots";
import { logRequest } from "@/lib/redis";
import {
  getUserPlan, checkRateLimit, checkApiKeyRateLimit,
  checkRenderFeatureGates,
  type PlanId,
} from "@/lib/plans";
import { computeUnits, ensureCredits, meterUsageToDodo, refundCredits } from "@/lib/credits";
import { resolveAuth, type AuthContext } from "@/lib/api-auth";
import { newRequestId } from "@/lib/request-id";
import { logger } from "@/lib/logger";
import { validateTargetUrl, SsrfError } from "@/lib/security/ssrf";
import { assertGeoRequestAllowed, GeoTargetingError } from "@/lib/browser/geo";
import { fireWebhookEvent } from "@/lib/webhooks";

function callerIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

/** Per-key limit on top of the plan-level window. */
async function enforceRequestLimits(
  authCtx: AuthContext
): Promise<{ allowed: boolean; retryAfterMs: number; limit: number; remaining: number; reset: number } | null> {
  if (authCtx.source === "api" && authCtx.apiKeyId && authCtx.apiKeyRateLimit) {
    const keyLimit = await checkApiKeyRateLimit(authCtx.apiKeyId, authCtx.apiKeyRateLimit);
    if (keyLimit && !keyLimit.allowed) return keyLimit;
  }
  return null;
}

function fireQuotaExceeded(userId: string, projectId: string | null, plan: PlanId): void {
  fireWebhookEvent({
    userId,
    projectId,
    event: "quota.exceeded",
    data: { reason: "insufficient_credits", plan },
  }).catch(() => {});
}
import {
  featureUnavailable, getRequestId, insufficientCredits, internalError,
  jsonError, missingTarget, normalizeUrl, rateLimited, rateLimitHeaders,
  unauthorized, zodErrorResponse,
} from "@/lib/api";

export const maxDuration = 90;

function ssrfErrorResponse(err: SsrfError, requestId?: string): NextResponse {
  return err.code === "INVALID_URL"
    ? jsonError(400, "invalid_url", err.message, requestId)
    : jsonError(403, "ssrf_blocked", err.message, requestId);
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
  source: "app" | "api" = "app",
  ctx: { projectId?: string | null; requestId?: string | null; ipHash?: string; userAgent?: string } = {}
): Promise<string | null> {
  const key = uniqueKey(options.url ?? "screenshot", result.format);
  const creditsMetadata =
    ensureMeta && typeof ensureMeta.units === "number"
      ? ({ credits_used: ensureMeta.units, mode: ensureMeta.mode ?? "deducted", cached: options.cached } as Record<string, unknown>)
      : ({ cached: options.cached } as Record<string, unknown>);

  let publicUrl: string | null = null;

  try {
    publicUrl = await uploadToStorage(buffer, key, artifactContentType(result.format));
  } catch (e) {
    logger.error({ event: "take_upload_failed", requestId: ctx.requestId ?? undefined, error: e instanceof Error ? e.message : e });
  }

  if (userId) {
    saveScreenshot({
      userId,
      projectId: ctx.projectId,
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
        request_id: ctx.requestId,
        response_time_ms: Date.now() - startTime,
      },
    }).catch((e) => logger.error({ event: "save_screenshot_failed", requestId: ctx.requestId ?? undefined, error: e.message }));

    logScreenshotUsage({
      userId,
      projectId: ctx.projectId,
      apiKeyId: apiKeyId ?? undefined,
      requestId: ctx.requestId,
      endpoint: "/api/take",
      method: options.method,
      statusCode: 200,
      screenshotUrl: publicUrl,
      cached: options.cached,
      responseTimeMs: Date.now() - startTime,
      creditsUsed: ensureMeta?.units ?? 0,
      source,
      ipHash: ctx.ipHash,
      userAgent: ctx.userAgent,
    }).catch(() => {});
  }

  return publicUrl;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestId(request) ?? newRequestId();
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
    const { userId, apiKeyId, projectId } = authCtx;
    const source = authCtx.source;
    const callerIpHash = ipHash(callerIp(request) ?? "unknown");
    const userAgent = request.headers.get("user-agent") ?? undefined;

    // ── Plan enforcement ─────────────────────────────────────────────
    const plan: PlanId = await getUserPlan(userId);

    const rateLimitInfo = await checkRateLimit(userId, plan);
    if (!rateLimitInfo.allowed) {
      return rateLimited(rateLimitInfo.retryAfterMs, rateLimitInfo, requestId);
    }
    const keyLimitFailure = await enforceRequestLimits(authCtx);
    if (keyLimitFailure) {
      return rateLimited(keyLimitFailure.retryAfterMs, keyLimitFailure, requestId);
    }

    const gateFailure = checkRenderFeatureGates(plan, {
      format: options.format,
      full_page: options.full_page,
      selector: options.selector,
      country: options.country,
    });
    if (gateFailure) {
      return featureUnavailable(`${gateFailure.message} Upgrade at /dashboard/plan`, requestId);
    }

    // ── Geo availability (fail fast before credits) ─────────────────
    if (options.country) {
      try {
        await assertGeoRequestAllowed(options.country);
      } catch (err) {
        if (err instanceof GeoTargetingError) {
          return err.code === "GEO_NOT_CONFIGURED"
            ? jsonError(503, "geo_unavailable", err.message, requestId)
            : jsonError(400, err.code.toLowerCase(), err.message, requestId);
        }
        throw err;
      }
    }

    // ── SSRF guard (DNS + private-IP check) ─────────────────────────
    if (options.url) {
      try {
        await validateTargetUrl(options.url);
      } catch (err) {
        if (err instanceof SsrfError) return ssrfErrorResponse(err, requestId);
        throw err;
      }
    }

    const cacheKey = getCacheKey(rawParams);
    const cached = await getFromCache(cacheKey);

    if (cached) {
      const ensure = await ensureCredits(userId, {
        cached: true,
        format: options.format,
        pdfPages: options.pdfPages,
        videoSeconds: options.video_seconds,
        geoTargeted: Boolean(options.country),
        meterMetadata: { endpoint: "/api/take", method: "GET", cache: "hit" },
      });
      if (!ensure.allowed) {
        fireQuotaExceeded(userId, projectId, plan);
        return insufficientCredits(requestId);
      }

      // Fire-and-forget: record the served screenshot + usage in the background
      saveScreenshot({
        userId,
        projectId,
        apiKeyId: apiKeyId ?? undefined,
        sourceUrl: options.url,
        storageUrl: cached.storageUrl,
        format: cached.format,
        width: cached.width,
        height: cached.height,
        fileSizeBytes: cached.sizeBytes,
        cached: true,
        metadata: {
          credits_used: ensure.units,
          mode: ensure.mode,
          cached: true,
          full_page: options.full_page,
          dark_mode: options.dark_mode,
          viewport_width: options.viewport_width,
          viewport_height: options.viewport_height,
          method: "GET",
          request_id: requestId,
          response_time_ms: Date.now() - startTime,
        },
      }).catch((e) => logger.error({ event: "save_screenshot_failed", requestId, error: e.message }));

      logScreenshotUsage({
        userId,
        projectId,
        apiKeyId: apiKeyId ?? undefined,
        requestId,
        endpoint: "/api/take",
        method: "GET",
        statusCode: 200,
        screenshotUrl: cached.storageUrl,
        cached: true,
        responseTimeMs: Date.now() - startTime,
        creditsUsed: ensure.units,
        source,
        ipHash: callerIpHash,
        userAgent,
      }).catch(() => {});

      logRequest(userId, {
        ts: new Date().toISOString(),
        endpoint: "/api/take",
        method: "GET",
        status: 200,
        ms: Date.now() - startTime,
        cached: true,
        url: options.url,
      }).catch(() => {});

      // Serve straight from R2 — no bytes through our server, no bandwidth cost.
      return NextResponse.redirect(cached.storageUrl, {
        status: 302,
        headers: {
          "X-Cache": "HIT",
          "X-Credits-Used": String(ensure.units),
          ...(requestId ? { "x-request-id": requestId } : {}),
          ...rateLimitHeaders(rateLimitInfo),
        },
      });
    }

    // Deduct or meter credits before rendering. Dodo metering is deferred to
    // after a successful render so failures are never billed on either side.
    const ensure = await ensureCredits(userId, {
      cached: false,
      format: options.format,
      pdfPages: options.pdfPages,
      videoSeconds: options.video_seconds,
      geoTargeted: Boolean(options.country),
      meterMetadata: {
        endpoint: "/api/take",
        method: "GET",
        ...(options.country ? { country: options.country } : {}),
      },
      meter: false,
    });
    if (!ensure.allowed) {
      fireQuotaExceeded(userId, projectId, plan);
      return insufficientCredits(requestId);
    }

    let result: Awaited<ReturnType<typeof render>>;
    try {
      result = await render(options);
    } catch (error) {
      // Never charge for a render that failed — refund whatever was deducted
      // locally (full amount in "deducted" mode, partial in overage mode).
      await refundCredits(userId, ensure.localDeducted);
      if (error instanceof RenderError && error.code === "INVALID_COUNTRY") {
        return jsonError(400, "invalid_country", error.message, requestId);
      }
      if (error instanceof RenderError && error.code === "UNSUPPORTED_COUNTRY") {
        return jsonError(400, "unsupported_country", error.message, requestId);
      }
      if (error instanceof RenderError && error.code === "GEO_UNAVAILABLE") {
        return jsonError(503, "geo_unavailable", error.message, requestId);
      }
      throw error;
    }

    const { kind } = computeUnits({
      cached: false,
      format: options.format,
      pdfPages: options.pdfPages,
      videoSeconds: options.video_seconds,
      geoTargeted: Boolean(options.country),
    });
    await meterUsageToDodo(userId, ensure.units, kind, {
      endpoint: "/api/take",
      method: "GET",
      ...(options.country ? { country: options.country } : {}),
    }).catch(() => {});

    // Fire-and-forget: upload + save to DB in background
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
      source,
      { projectId, requestId, ipHash: callerIpHash, userAgent }
    ).then((publicUrl) => {
      // Cache only the R2 URL once the upload has succeeded.
      if (publicUrl) {
        setInCache(
          cacheKey,
          {
            storageUrl: publicUrl,
            width: result.width,
            height: result.height,
            format: result.format,
            sizeBytes: result.buffer.length,
          },
          plan
        ).catch(() => {});
      }
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
        "Content-Type": artifactContentType(options.format),
        "Content-Length": result.buffer.length.toString(),
        "Content-Disposition": `inline; filename="${getFilename(options.url ?? "screenshot", ext)}"`,
        "X-Cache": "MISS",
        "X-Credits-Used": String(ensure.units),
        ...(requestId ? { "x-request-id": requestId } : {}),
        ...rateLimitHeaders(rateLimitInfo),
      },
    });
  } catch (error) {
    if (error instanceof SsrfError) return ssrfErrorResponse(error, requestId);
    if (error instanceof RenderError && error.code === "SSRF_BLOCKED") {
      return jsonError(403, "ssrf_blocked", error.message, requestId);
    }
    return internalError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestId(request) ?? newRequestId();
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
    const { userId, apiKeyId, projectId } = authCtx;
    const source = authCtx.source;
    const callerIpHash = ipHash(callerIp(request) ?? "unknown");
    const userAgent = request.headers.get("user-agent") ?? undefined;

    // ── Plan enforcement ─────────────────────────────────────────────
    const plan: PlanId = await getUserPlan(userId);

    const rateLimitInfo = await checkRateLimit(userId, plan);
    if (!rateLimitInfo.allowed) {
      return rateLimited(rateLimitInfo.retryAfterMs, rateLimitInfo, requestId);
    }
    const keyLimitFailure = await enforceRequestLimits(authCtx);
    if (keyLimitFailure) {
      return rateLimited(keyLimitFailure.retryAfterMs, keyLimitFailure, requestId);
    }

    const gateFailure = checkRenderFeatureGates(plan, {
      format: options.format,
      full_page: options.full_page,
      selector: options.selector,
      country: options.country,
    });
    if (gateFailure) {
      return featureUnavailable(`${gateFailure.message} Upgrade at /dashboard/plan`, requestId);
    }

    // ── Geo availability (fail fast before credits) ─────────────────
    if (options.country) {
      try {
        await assertGeoRequestAllowed(options.country);
      } catch (err) {
        if (err instanceof GeoTargetingError) {
          return err.code === "GEO_NOT_CONFIGURED"
            ? jsonError(503, "geo_unavailable", err.message, requestId)
            : jsonError(400, err.code.toLowerCase(), err.message, requestId);
        }
        throw err;
      }
    }

    // ── SSRF guard (DNS + private-IP check) ─────────────────────────
    if (options.url) {
      try {
        await validateTargetUrl(options.url);
      } catch (err) {
        if (err instanceof SsrfError) return ssrfErrorResponse(err, requestId);
        throw err;
      }
    }

    // Check cache before rendering (POST handler)
    const cacheKey = getCacheKey(options as unknown as Record<string, unknown>);
    const cached = await getFromCache(cacheKey);

    if (cached) {
      const publicUrl = cached.storageUrl;

      const ensure = await ensureCredits(userId, {
        cached: true,
        format: options.format,
        pdfPages: options.pdfPages,
        videoSeconds: options.video_seconds,
        geoTargeted: Boolean(options.country),
        meterMetadata: { endpoint: "/api/take", method: "POST", cache: "hit" },
      });
      if (!ensure.allowed) {
        fireQuotaExceeded(userId, projectId, plan);
        return insufficientCredits(requestId);
      }

      saveScreenshot({
        userId,
        projectId,
        apiKeyId: apiKeyId ?? undefined,
        sourceUrl: options.url,
        storageUrl: publicUrl,
        format: cached.format,
        width: cached.width,
        height: cached.height,
        fileSizeBytes: cached.sizeBytes,
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
          request_id: requestId,
          response_time_ms: Date.now() - startTime,
        },
      }).catch((e) => logger.error({ event: "save_screenshot_failed", requestId, error: e.message }));

      logScreenshotUsage({
        userId,
        projectId,
        apiKeyId: apiKeyId ?? undefined,
        requestId,
        endpoint: "/api/take",
        method: "POST",
        statusCode: 200,
        screenshotUrl: publicUrl,
        cached: true,
        responseTimeMs: Date.now() - startTime,
        creditsUsed: ensure.units,
        source,
        ipHash: callerIpHash,
        userAgent,
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
        format: cached.format,
        width: cached.width,
        height: cached.height,
        size: cached.sizeBytes,
        cached: true,
      }, {
        headers: {
          "X-Cache": "HIT",
          "X-Credits-Used": String(ensure.units),
          ...(requestId ? { "x-request-id": requestId } : {}),
          ...rateLimitHeaders(rateLimitInfo),
        },
      });
    }

    // Deduct or meter credits before rendering. Dodo metering is deferred to
    // after a successful render so failures are never billed on either side.
    const ensure = await ensureCredits(userId, {
      cached: false,
      format: options.format,
      pdfPages: options.pdfPages,
      videoSeconds: options.video_seconds,
      geoTargeted: Boolean(options.country),
      meterMetadata: {
        endpoint: "/api/take",
        method: "POST",
        ...(options.country ? { country: options.country } : {}),
      },
      meter: false,
    });
    if (!ensure.allowed) {
      fireQuotaExceeded(userId, projectId, plan);
      return insufficientCredits(requestId);
    }

    let result: Awaited<ReturnType<typeof render>>;
    try {
      result = await render(options);
    } catch (error) {
      // Never charge for a render that failed — refund whatever was deducted
      // locally (full amount in "deducted" mode, partial in overage mode).
      await refundCredits(userId, ensure.localDeducted);
      if (error instanceof RenderError && error.code === "INVALID_COUNTRY") {
        return jsonError(400, "invalid_country", error.message, requestId);
      }
      if (error instanceof RenderError && error.code === "UNSUPPORTED_COUNTRY") {
        return jsonError(400, "unsupported_country", error.message, requestId);
      }
      if (error instanceof RenderError && error.code === "GEO_UNAVAILABLE") {
        return jsonError(503, "geo_unavailable", error.message, requestId);
      }
      throw error;
    }

    const { kind } = computeUnits({
      cached: false,
      format: options.format,
      pdfPages: options.pdfPages,
      videoSeconds: options.video_seconds,
      geoTargeted: Boolean(options.country),
    });
    await meterUsageToDodo(userId, ensure.units, kind, {
      endpoint: "/api/take",
      method: "POST",
      ...(options.country ? { country: options.country } : {}),
    }).catch(() => {});

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
        source,
        { projectId, requestId, ipHash: callerIpHash, userAgent }
      );
    } catch {
      // Upload failed — still return the format/dimensions
    }

    // Store the R2 URL in cache (buffer never hits Redis)
    if (publicUrl) {
      setInCache(
        cacheKey,
        {
          storageUrl: publicUrl,
          width: result.width,
          height: result.height,
          format: result.format,
          sizeBytes: result.buffer.length,
        },
        plan
      ).catch(() => {});
    }

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
        ...(requestId ? { "x-request-id": requestId } : {}),
        ...rateLimitHeaders(rateLimitInfo),
      },
    });
  } catch (error) {
    if (error instanceof SsrfError) return ssrfErrorResponse(error, requestId);
    return internalError(error, requestId);
  }
}
