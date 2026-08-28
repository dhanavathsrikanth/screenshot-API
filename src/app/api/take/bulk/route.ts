import { NextRequest, NextResponse } from "next/server";
import { BulkScreenshotSchema } from "@/lib/schema";
import { bulkRender } from "@/lib/screenshot/bulk";
import { uploadToStorage } from "@/lib/storage/uploader";
import { artifactContentType } from "@/lib/mime";
import { saveScreenshot } from "@/app/actions/screenshots";
import { logScreenshotUsage } from "@/app/actions/usage";
import { logRequest } from "@/lib/redis";
import { getFilename } from "@/lib/utils";
import {
  getUserPlan, checkRateLimit, checkApiKeyRateLimit,
  checkRenderFeatureGates,
  type PlanId,
} from "@/lib/plans";
import { ensureCredits, refundCredits, computeUnits, meterUsageToDodo } from "@/lib/credits";
import { resolveAuth, type AuthContext } from "@/lib/api-auth";
import { assertGeoRequestAllowed, GeoTargetingError } from "@/lib/browser/geo";
import { fireWebhookEvent } from "@/lib/webhooks";
import {
  featureUnavailable, getRequestId, insufficientCredits, internalError,
  jsonError, normalizeUrl, rateLimited, rateLimitHeaders, unauthorized,
  zodErrorResponse,
} from "@/lib/api";

export const maxDuration = 90;

function uniqueKey(url: string, format: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const base = getFilename(url, format);
  return `${ts}_${rand}_${base}`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestId(request);
  try {
    const body = await request.json();
    if (
      body &&
      typeof body === "object" &&
      Array.isArray((body as { urls?: unknown }).urls)
    ) {
      (body as { urls: unknown[] }).urls = (
        body as { urls: string[] }
      ).urls.map((u) => (typeof u === "string" ? normalizeUrl(u) : u));
    }

    const parsed = BulkScreenshotSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error, requestId);
    }

    const { urls, concurrency, max_retries, ...renderOptions } = parsed.data;

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
    // Per-key limit (api_keys.rate_limit) on top of the user-wide plan window.
    if (authCtx.source === "api" && authCtx.apiKeyId && authCtx.apiKeyRateLimit) {
      const keyLimit = await checkApiKeyRateLimit(authCtx.apiKeyId, authCtx.apiKeyRateLimit);
      if (keyLimit && !keyLimit.allowed) {
        return rateLimited(keyLimit.retryAfterMs, keyLimit, requestId);
      }
    }

    const gateFailure = checkRenderFeatureGates(plan, {
      format: renderOptions.format,
      full_page: renderOptions.full_page,
      selector: renderOptions.selector,
      country: renderOptions.country,
    });
    if (gateFailure) {
      return featureUnavailable(`${gateFailure.message} Upgrade at /dashboard/plan`, requestId);
    }

    // ── Geo availability (fail fast before credits) ─────────────────
    if (renderOptions.country) {
      try {
        await assertGeoRequestAllowed(renderOptions.country);
      } catch (err) {
        if (err instanceof GeoTargetingError) {
          return err.code === "GEO_NOT_CONFIGURED"
            ? jsonError(503, "geo_unavailable", err.message, requestId)
            : jsonError(400, err.code.toLowerCase(), err.message, requestId);
        }
        throw err;
      }
    }

    // Deduct credits upfront for the whole batch (bulkCount covers per-URL + per-page pricing).
    // Metering is deferred (meter: false) so Dodo only charges for renders that succeed —
    // failures are refunded locally and must not be metered.
    const ensure = await ensureCredits(userId, {
      cached: false,
      format: renderOptions.format,
      bulkCount: urls.length,
      videoSeconds: renderOptions.video_seconds,
      geoTargeted: Boolean(renderOptions.country),
      meterMetadata: { endpoint: "/api/take/bulk", method: "POST", requested: urls.length },
      meter: false,
    });
    if (!ensure.allowed) {
      fireWebhookEvent({
        userId,
        projectId: authCtx.projectId,
        event: "quota.exceeded",
        data: { reason: "insufficient_credits", plan },
      }).catch(() => {});
      return insufficientCredits(requestId);
    }

    const results = await bulkRender(urls, renderOptions, {
      concurrency,
      maxRetries: max_retries,
    });

    const { units: unitCost, kind } = computeUnits({
      cached: false,
      format: renderOptions.format,
      videoSeconds: renderOptions.video_seconds,
      geoTargeted: Boolean(renderOptions.country),
    });

    // Cap total refunds at what was actually deducted from the local balance.
    // In overage mode, only `ensure.localDeducted` (which can be less than
    // `ensure.units`) was ever taken from credit_balance/top_up_balance — the
    // rest was covered via Dodo metering, not locally, so refunding a full
    // `unitCost` per failed URL could refund more than was ever deducted.
    let refundableRemaining = ensure.localDeducted;

    for (const r of results) {
      if (r.success && r.renderResult) {
        let publicUrl: string | null = null;
        try {
          const key = uniqueKey(r.url, r.renderResult.format);
          publicUrl = await uploadToStorage(
            r.renderResult.buffer,
            key,
            artifactContentType(r.renderResult.format)
          );
        } catch {}

        saveScreenshot({
          userId,
          apiKeyId: apiKeyId ?? undefined,
          sourceUrl: r.url,
          storageUrl: publicUrl,
          format: r.renderResult.format,
          width: r.renderResult.width,
          height: r.renderResult.height,
          fileSizeBytes: r.renderResult.buffer.length,
          cached: false,
        }).catch(() => {});

        logScreenshotUsage({
          userId,
          apiKeyId: apiKeyId ?? undefined,
          endpoint: "/api/take/bulk",
          method: "POST",
          statusCode: 200,
          screenshotUrl: publicUrl,
          cached: false,
          responseTimeMs: Math.round((Date.now() - startTime) / results.length),
          creditsUsed: unitCost,
          source,
        }).catch(() => {});
      } else if (refundableRemaining > 0) {
        // Refund the unit cost for failed URLs so the user isn't charged for
        // failures, capped at what was actually deducted locally.
        const refundAmount = Math.min(unitCost, refundableRemaining);
        await refundCredits(userId, refundAmount);
        refundableRemaining -= refundAmount;
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    // Meter only the renders that actually succeeded so Dodo's balance mirrors
    // the local post-refund total.
    if (successful > 0) {
      await meterUsageToDodo(userId, successful * unitCost, kind, {
        endpoint: "/api/take/bulk",
        method: "POST",
        requested: urls.length,
        successful,
        failed,
      });
    }

    logRequest(userId, {
      ts: new Date().toISOString(),
      endpoint: "/api/take/bulk",
      method: "POST",
      status: 200,
      ms: Date.now() - startTime,
      cached: false,
      url: urls[0],
    }).catch(() => {});

    const totalRefunded = ensure.localDeducted - refundableRemaining;

    return NextResponse.json({
      total: results.length,
      successful,
      failed,
      creditsUsed: ensure.units - totalRefunded,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      results: results.map(({ renderResult, ...rest }) => rest),
    }, {
      headers: {
        "X-Credits-Used": String(ensure.units),
        ...rateLimitHeaders(rateLimitInfo),
      },
    });
  } catch (error) {
    return internalError(error, requestId);
  }
}
