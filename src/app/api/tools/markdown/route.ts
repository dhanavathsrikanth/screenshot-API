import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ScreenshotOptionsSchema } from "@/lib/schema";
import { render } from "@/lib/browser/engine";
import { htmlToMarkdown } from "@/lib/markdown-html";
import { resolveAuth } from "@/lib/api-auth";
import { ensureCredits } from "@/lib/credits";
import { checkRateLimit, getUserPlan } from "@/lib/plans";
import { checkGuestToolLimit } from "@/lib/tools";
import { TOOL_GUEST_DAILY_LIMIT } from "@/lib/tool-limits";
import { logScreenshotUsage } from "@/app/actions/usage";
import { logRequest } from "@/lib/redis";
import { validateTargetUrl, SsrfError } from "@/lib/security/ssrf";
import {
  getClientIp, getRequestId, internalError, invalidUrl, jsonError,
  normalizeUrl, rateLimited, rateLimitHeaders, zodErrorResponse,
} from "@/lib/api";

export const maxDuration = 60;

const MarkdownRequestSchema = z.object({
  url: z.string().url(),
  client_id: z.string().min(8).max(128).optional(),
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestId(request);
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = MarkdownRequestSchema.safeParse({
      ...body,
      url:
        typeof body.url === "string"
          ? normalizeUrl(body.url)
          : body.url,
    });
    if (!parsed.success) {
      return zodErrorResponse(parsed.error, requestId);
    }

    const input = parsed.data;

    try {
      const protocol = new URL(input.url).protocol;
      if (protocol !== "http:" && protocol !== "https:") {
        return invalidUrl(undefined, requestId);
      }
    } catch {
      return invalidUrl("Invalid URL.", requestId);
    }

    // Full SSRF guard (private-IP / DNS-rebinding check) up front, before
    // acquiring a browser page slot — this is a public, unauthenticated
    // endpoint, so a malicious URL must be rejected as cheaply as possible.
    try {
      await validateTargetUrl(input.url);
    } catch (err) {
      if (err instanceof SsrfError) {
        return jsonError(err.code === "INVALID_URL" ? 400 : 403, err.code.toLowerCase(), err.message, requestId);
      }
      throw err;
    }

    const authCtx = await resolveAuth(request);
    const isGuest = !authCtx;

    let creditsUsed = 0;
    let rateLimitHeadersObj: Record<string, string> = {};

    if (isGuest) {
      const ip = getClientIp(request);
      const burstId = input.client_id ?? `ip:${ip}`;
      const limit = await checkGuestToolLimit(burstId, ip);

      rateLimitHeadersObj = rateLimitHeaders({
        limit: limit.limit,
        remaining: Math.max(0, limit.remaining),
        reset: limit.reset,
      });

      if (!limit.allowed) {
        return rateLimited(
          limit.retryAfterMs,
          { limit: limit.limit, remaining: Math.max(0, limit.remaining), reset: limit.reset },
          requestId,
          `Guest limit reached. Free tools are limited to ${TOOL_GUEST_DAILY_LIMIT} conversions per day. Sign in for higher limits.`
        );
      }
    } else {
      const { userId } = authCtx;
      const plan = await getUserPlan(userId);
      const rateLimitInfo = await checkRateLimit(userId, plan);

      rateLimitHeadersObj = rateLimitHeaders(rateLimitInfo);

      if (!rateLimitInfo.allowed) {
        return rateLimited(rateLimitInfo.retryAfterMs, rateLimitInfo, requestId);
      }

      const ensure = await ensureCredits(userId, {
        cached: false,
        format: "png",
        pdfPages: 1,
        meterMetadata: { endpoint: "/api/tools/markdown", method: "POST" },
      });
      if (!ensure.allowed) {
        return jsonError(402, "insufficient_credits", "No credits remaining. Upgrade or buy credits from the dashboard.", requestId);
      }
      creditsUsed = ensure.units;
    }

    const renderOptions = ScreenshotOptionsSchema.parse({
      url: input.url,
      format: "html",
      viewport_width: 1280,
      viewport_height: 720,
      device_scale_factor: 1,
      full_page: false,
      dark_mode: false,
      block_ads: true,
      block_cookie_banners: true,
      quality: 85,
    });

    const result = await render(renderOptions);
    const markdown = htmlToMarkdown(result.buffer.toString("utf-8"));

    if (authCtx) {
      const { userId, apiKeyId } = authCtx;
      logScreenshotUsage({
        userId,
        apiKeyId: apiKeyId ?? undefined,
        endpoint: "/api/tools/markdown",
        method: "POST",
        statusCode: 200,
        screenshotUrl: null,
        cached: false,
        responseTimeMs: Date.now() - startTime,
        creditsUsed,
        source: "app",
      }).catch(() => {});
      logRequest(userId, {
        ts: new Date().toISOString(),
        endpoint: "/api/tools/markdown",
        method: "POST",
        status: 200,
        ms: Date.now() - startTime,
        cached: false,
        url: input.url,
      }).catch(() => {});
    }

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": "inline",
        "X-Free-Tool": "1",
        ...rateLimitHeadersObj,
      },
    });
  } catch (error) {
    return internalError(error, requestId);
  }
}
