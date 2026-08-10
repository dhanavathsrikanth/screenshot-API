import { NextRequest, NextResponse } from "next/server";
import { BulkScreenshotSchema } from "@/lib/schema";
import { bulkRender } from "@/screenshot-engine/bulk";
import { uploadToStorage } from "@/screenshot-engine/uploader";
import { saveScreenshot } from "@/app/actions/screenshots";
import { logScreenshotUsage } from "@/app/actions/usage";
import { logRequest } from "@/lib/redis";
import { getFilename } from "@/lib/utils";
import {
  getUserPlan, checkRateLimit,
  isFormatAllowed, isAdBlockingAllowed, isCookieBlockingAllowed,
  type PlanId,
} from "@/lib/plans";
import { ensureCredits, refundCredits, computeUnits, meterUsageToDodo } from "@/lib/credits";
import { resolveAuth, type AuthContext } from "@/lib/api-auth";

export const maxDuration = 60;

function uniqueKey(url: string, format: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const base = getFilename(url, format);
  return `${ts}_${rand}_${base}`;
}

function unauthorized() {
  return NextResponse.json(
    {
      error:
        "Authentication required. Sign in at /dashboard or include a valid API key via the Authorization: Bearer header.",
    },
    { status: 401 }
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const parsed = BulkScreenshotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { urls, concurrency, max_retries, ...renderOptions } = parsed.data;

    const authCtx: AuthContext | null = await resolveAuth(request);
    if (!authCtx) return unauthorized();
    const { userId, apiKeyId } = authCtx;
    const source = authCtx.source;

    // ── Plan enforcement ─────────────────────────────────────────────
    const plan: PlanId = await getUserPlan(userId);

    const rateLimitInfo = await checkRateLimit(userId, plan);
    if (!rateLimitInfo.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimitInfo.retryAfterMs / 1000)) } }
      );
    }

    if (!isFormatAllowed(renderOptions.format, plan)) {
      return NextResponse.json(
        { error: `Format "${renderOptions.format}" requires a paid plan. Upgrade at /dashboard/settings` },
        { status: 403 }
      );
    }

    if (!isAdBlockingAllowed(plan)) renderOptions.block_ads = false;
    if (!isCookieBlockingAllowed(plan)) renderOptions.block_cookie_banners = false;

    // Deduct credits upfront for the whole batch (bulkCount covers per-URL + per-page pricing).
    // Metering is deferred (meter: false) so Dodo only charges for renders that succeed —
    // failures are refunded locally and must not be metered.
    const ensure = await ensureCredits(userId, {
      cached: false,
      format: renderOptions.format,
      bulkCount: urls.length,
      meterMetadata: { endpoint: "/api/take/bulk", method: "POST", requested: urls.length },
      meter: false,
    });
    if (!ensure.allowed) {
      return NextResponse.json(
        { error: "No credits remaining. Upgrade or buy credits." },
        { status: 402 }
      );
    }

    const results = await bulkRender(urls, renderOptions, {
      concurrency,
      maxRetries: max_retries,
    });

    const { units: unitCost, kind } = computeUnits({ cached: false, format: renderOptions.format });

    for (const r of results) {
      if (r.success && r.renderResult) {
        let publicUrl: string | null = null;
        try {
          const key = uniqueKey(r.url, r.renderResult.format);
          publicUrl = await uploadToStorage(
            r.renderResult.buffer,
            key,
            `image/${r.renderResult.format}`
          );
        } catch {}

        saveScreenshot({
          userId,
          apiKeyId: apiKeyId ?? undefined,
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
      } else {
        // Refund the unit cost for failed URLs so the user isn't charged for failures
        await refundCredits(userId, unitCost);
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

    return NextResponse.json({
      total: results.length,
      successful,
      failed,
      creditsUsed: ensure.mode === "overage" ? ensure.units : ensure.units - failed * unitCost,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      results: results.map(({ renderResult, ...rest }) => rest),
    }, {
      headers: {
        "X-Credits-Used": String(ensure.units),
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
