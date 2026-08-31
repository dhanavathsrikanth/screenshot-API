import { NextRequest } from "next/server";
import { V1ScreenshotRequestSchema, buildRenderOptions } from "@/lib/v1-schema";
import { resolveAuth } from "@/lib/api-auth";
import {
  getUserPlan, checkRateLimit, getQueuePriority,
  checkApiKeyRateLimit, checkRenderFeatureGates, planGateDetails,
} from "@/lib/plans";
import { assertGeoRequestAllowed, GeoTargetingError } from "@/lib/browser/geo";
import { ensureCredits } from "@/lib/credits";
import { createJob, enqueueJob, getJob, newJobId, processJob, recordCacheHitJob } from "@/lib/jobs";
import { v1Ok, v1Err, v1RateLimited } from "@/lib/v1-api";
import { getRequestId, httpStatusForErrorCode, normalizeUrl, rateLimitHeaders } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { validateTargetUrl, SsrfError } from "@/lib/security/ssrf";
import { getCacheKey, getFromCache } from "@/lib/storage/cache";
import { logScreenshotUsage, ipHash } from "@/app/actions/usage";
import { createServiceClient } from "@/lib/supabase/server";
import { trackQuotaReached } from "@/lib/analytics-events";
import { fireWebhookEvent } from "@/lib/webhooks";
import { renderPhase } from "@/lib/screenshot/types";

export const maxDuration = 90;

function callerIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

function toListItem(job: {
  id: string;
  status: string;
  queue: string;
  priority: number;
  screenshot_id: string | null;
  storage_url: string | null;
  format: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}) {
  return {
    id: job.id,
    status: job.status,
    queue: job.queue,
    priority: job.priority,
    status_url: `/api/v1/screenshots/${job.id}`,
    screenshot:
      job.status === "completed"
        ? {
            id: job.screenshot_id,
            url: job.storage_url,
            format: job.format,
            width: job.width,
            height: job.height,
            size: job.size_bytes,
            created_at: job.completed_at,
          }
        : null,
    error:
      job.status === "failed"
        ? { code: job.error_code, message: job.error_message }
        : null,
    created_at: job.created_at,
    updated_at: job.completed_at ?? job.started_at ?? job.created_at,
  };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }

    const url = new URL(request.url);
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
    const before = url.searchParams.get("before") ?? null;

    const supabase = createServiceClient();
    let query = supabase
      .from("screenshot_jobs")
      .select("id, status, queue, priority, screenshot_id, storage_url, format, width, height, size_bytes, error_code, error_message, created_at, started_at, completed_at")
      .eq("user_id", authCtx.userId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (before) {
      const beforeDate = new Date(before);
      if (Number.isNaN(beforeDate.getTime())) {
        return v1Err(400, "invalid_parameters", "The `before` cursor must be an ISO 8601 timestamp.", requestId);
      }
      query = query.lt("created_at", beforeDate.toISOString());
    }

    const { data, error } = await query;
    if (error) {
      return v1Err(500, "internal_error", error.message, requestId);
    }

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].created_at : null;

    return v1Ok({
      screenshots: page.map(toListItem),
      pagination: {
        limit,
        before,
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const sync = new URL(request.url).searchParams.get("sync") === "true";

    const body = await request.json().catch(() => ({}));
    if (body && typeof body === "object" && typeof (body as { url?: unknown }).url === "string") {
      (body as { url: string }).url = normalizeUrl((body as { url: string }).url);
    }

    const parsed = V1ScreenshotRequestSchema.safeParse(body);
    if (!parsed.success) {
      return v1Err(400, "invalid_parameters", "Invalid parameters.", requestId, parsed.error.flatten());
    }

    const input = parsed.data;
    if (!input.url && !input.html && !input.markdown) {
      return v1Err(400, "missing_target", "Must provide url, html, or markdown.", requestId);
    }
    if (input.url) {
      try {
        const p = new URL(input.url);
        if (p.protocol !== "http:" && p.protocol !== "https:") {
          return v1Err(400, "invalid_url", "Only http:// and https:// URLs are supported.", requestId);
        }
      } catch {
        return v1Err(400, "invalid_url", "The provided URL is invalid.", requestId);
      }
    }

    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }
    const { userId, apiKeyId, projectId, source } = authCtx;

    const plan = await getUserPlan(userId);
    const rateLimitInfo = await checkRateLimit(userId, plan);
    if (!rateLimitInfo.allowed) {
      return v1RateLimited(rateLimitInfo.retryAfterMs, rateLimitInfo, requestId);
    }
    // Per-key limit (api_keys.rate_limit) on top of the user-wide plan window.
    if (authCtx.source === "api" && authCtx.apiKeyId && authCtx.apiKeyRateLimit) {
      const keyLimit = await checkApiKeyRateLimit(authCtx.apiKeyId, authCtx.apiKeyRateLimit);
      if (keyLimit && !keyLimit.allowed) {
        return v1RateLimited(keyLimit.retryAfterMs, keyLimit, requestId);
      }
    }
    const gateFailure = checkRenderFeatureGates(plan, {
      format: input.format,
      full_page: input.full_page,
      selector: input.selector,
      country: input.country,
      video_seconds: input.video_seconds,
    });
    if (gateFailure) {
      return v1Err(403, "plan_feature", gateFailure.message, requestId, planGateDetails(gateFailure));
    }
    // Geo availability: fail fast (before credits/job) when the country is
    // invalid or not served by the configured proxy gateway.
    if (input.country) {
      try {
        await assertGeoRequestAllowed(input.country);
      } catch (err) {
        if (err instanceof GeoTargetingError) {
          const status = err.code === "GEO_NOT_CONFIGURED" ? 503 : 400;
          return v1Err(
            status,
            err.code === "GEO_NOT_CONFIGURED" ? "geo_unavailable" : err.code.toLowerCase(),
            err.message,
            requestId
          );
        }
        throw err;
      }
    }

    // ── SSRF guard (DNS + private-IP check) ─────────────────────────
    if (input.url) {
      try {
        await validateTargetUrl(input.url);
      } catch (err) {
        if (err instanceof SsrfError) {
          return v1Err(err.code === "INVALID_URL" ? 400 : 403, err.code, err.message, requestId);
        }
        throw err;
      }
    }

    const renderOptions = buildRenderOptions(input);

    // ── Cache first: a hit returns the R2 URL without rendering ──────
    const cacheKey = getCacheKey(renderOptions as unknown as Record<string, unknown>);
    const cached = await getFromCache(cacheKey);
    if (cached) {
      // Record the hit as a real completed job + screenshot row so the ID is
      // fetchable via /v1/screenshots/[id], appears in listings, and lands in
      // dashboard history (previously a bare cache hash with no DB records).
      const hit = await recordCacheHitJob({
        userId,
        projectId,
        apiKeyId,
        requestId,
        source,
        options: renderOptions,
        requestHash: cacheKey,
        creditsCharged: 0,
        priority: getQueuePriority(plan),
        entry: cached,
      });

      logScreenshotUsage({
        userId,
        projectId,
        apiKeyId: apiKeyId ?? undefined,
        requestId,
        endpoint: "/api/v1/screenshots",
        method: "POST",
        statusCode: 200,
        screenshotUrl: cached.storageUrl,
        cached: true,
        responseTimeMs: 0,
        creditsUsed: 0,
        source: "api",
        ipHash: ipHash(callerIp(request) ?? "unknown"),
        userAgent: request.headers.get("user-agent") ?? undefined,
      }).catch(() => {});

      fireWebhookEvent({
        userId,
        projectId,
        event: "screenshot.completed",
        data: {
          id: hit.id,
          status: "completed",
          cached: true,
          status_url: `/api/v1/screenshots/${hit.id}`,
          screenshot: {
            id: hit.screenshotId,
            url: cached.storageUrl,
            format: cached.format,
            width: cached.width,
            height: cached.height,
            size: cached.sizeBytes,
            created_at: hit.completedAt,
          },
          error: null,
          created_at: hit.completedAt,
          updated_at: hit.completedAt,
        },
      }).catch(() => {});

      return v1Ok(
        {
          id: hit.id,
          status: "completed",
          cached: true,
          screenshot: {
            id: hit.screenshotId,
            url: cached.storageUrl,
            format: cached.format,
            width: cached.width,
            height: cached.height,
            size: cached.sizeBytes,
            created_at: hit.completedAt,
          },
          status_url: `/api/v1/screenshots/${hit.id}`,
        },
        { status: 200, headers: rateLimitHeaders(rateLimitInfo), requestId }
      );
    }

    // Dodo metering is deferred to completeJob on successful completion, so
    // permanently failed jobs are refunded locally and never billed on the
    // Dodo side either (same pattern as /api/take/bulk).
    const ensure = await ensureCredits(userId, {
      cached: false,
      format: renderOptions.format,
      pdfPages: renderOptions.pdfPages,
      geoTargeted: Boolean(renderOptions.country),
      meterMetadata: {
        endpoint: "/api/v1/screenshots",
        method: "POST",
        ...(renderOptions.country ? { country: renderOptions.country } : {}),
      },
      meter: false,
    });
    if (!ensure.allowed) {
      trackQuotaReached(userId, "insufficient_credits").catch(() => {});
      fireWebhookEvent({
        userId,
        projectId,
        event: "quota.exceeded",
        data: { reason: "insufficient_credits", plan },
      }).catch(() => {});
      return v1Err(402, "insufficient_credits", "No credits remaining. Upgrade or buy credits.", requestId, {
        upgrade_url: "/dashboard/plan",
      });
    }

    const id = newJobId();
    await createJob({ id, userId, projectId, apiKeyId, requestId, source, options: renderOptions, creditsCharged: ensure.units, priority: getQueuePriority(plan), requestHash: cacheKey });

    if (sync) {
      await processJob(id);
      const final = await getJob(id);
      if (final && final.status === "completed") {
        return v1Ok(
          {
            id: final.id,
            status: "completed",
            screenshot: {
              id: final.screenshot_id,
              url: final.storage_url,
              format: final.format,
              width: final.width,
              height: final.height,
              size: final.size_bytes,
              created_at: final.completed_at,
            },
            status_url: `/api/v1/screenshots/${final.id}`,
          },
          { status: 200, headers: rateLimitHeaders(rateLimitInfo), requestId }
        );
      }
      const errorCode = (final?.error_code ?? "render_failed").toLowerCase();
      return v1Err(
        httpStatusForErrorCode(errorCode),
        errorCode,
        final?.error_message ?? "Render failed.",
        requestId,
        { phase: renderPhase(errorCode) }
      );
    }

    enqueueJob(id, { priority: getQueuePriority(plan) });
    return v1Ok(
      {
        id,
        status: "queued",
        queue: "screenshot",
        priority: getQueuePriority(plan),
        status_url: `/api/v1/screenshots/${id}`,
      },
      { status: 202, headers: rateLimitHeaders(rateLimitInfo), requestId }
    );
  } catch (error) {
    if (error instanceof SsrfError) {
      return v1Err(error.code === "INVALID_URL" ? 400 : 403, error.code, error.message, requestId);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
