import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ScreenshotOptionsSchema } from "@/lib/schema";
import { render } from "@/screenshot-engine/renderer";
import { getFilename } from "@/lib/utils";
import { resolveAuth } from "@/lib/api-auth";
import { ensureCredits } from "@/lib/credits";
import { checkRateLimit, getUserPlan } from "@/lib/plans";
import { checkGuestToolLimit } from "@/lib/tools";
import { TOOL_GUEST_DAILY_LIMIT } from "@/lib/tool-limits";
import { logScreenshotUsage } from "@/app/actions/usage";
import { logRequest } from "@/lib/redis";
import {
  getRequestId, internalError, invalidUrl, jsonError,
  normalizeUrl, rateLimited, rateLimitHeaders, zodErrorResponse,
} from "@/lib/api";

export const maxDuration = 60;

const ToolRequestSchema = z.object({
  url: z.string().url(),
  format: z.enum(["png", "jpeg", "webp", "pdf"]).default("png"),
  viewport_width: z.coerce.number().int().min(320).max(3840).default(1280),
  viewport_height: z.coerce.number().int().min(240).max(2160).default(720),
  device_scale_factor: z.coerce.number().int().min(1).max(2).default(1),
  full_page: z.coerce.boolean().default(false),
  dark_mode: z.coerce.boolean().default(false),
  block_ads: z.coerce.boolean().default(true),
  block_cookie_banners: z.coerce.boolean().default(true),
  pdf_format: z.enum(["a4", "a3", "letter", "legal"]).default("a4"),
  client_id: z.string().min(8).max(128).optional(),
});

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestId(request);
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = ToolRequestSchema.safeParse({
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

    const authCtx = await resolveAuth(request);
    const isGuest = !authCtx;

    let creditsUsed = 0;
    let rateLimitHeadersObj: Record<string, string> = {};

    if (isGuest) {
      // Anonymous users: burst per browser + daily cap per IP
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
          `Guest limit reached. Free tools are limited to ${TOOL_GUEST_DAILY_LIMIT} captures per day. Sign in for higher limits.`
        );
      }
    } else {
      // Signed-in users: normal plan rate limit + credit deduction
      const { userId } = authCtx;
      const plan = await getUserPlan(userId);
      const rateLimitInfo = await checkRateLimit(userId, plan);

      rateLimitHeadersObj = rateLimitHeaders(rateLimitInfo);

      if (!rateLimitInfo.allowed) {
        return rateLimited(rateLimitInfo.retryAfterMs, rateLimitInfo, requestId);
      }

      const ensure = await ensureCredits(userId, {
        cached: false,
        format: input.format,
        pdfPages: 1,
        meterMetadata: { endpoint: "/api/tools/capture", method: "POST" },
      });
      if (!ensure.allowed) {
        return jsonError(402, "insufficient_credits", "No credits remaining. Upgrade or buy credits from the dashboard.", requestId);
      }
      creditsUsed = ensure.units;
    }

    const renderOptions = ScreenshotOptionsSchema.parse({
      url: input.url,
      format: input.format,
      viewport_width: input.viewport_width,
      viewport_height: input.viewport_height,
      device_scale_factor: input.device_scale_factor,
      full_page: input.full_page,
      dark_mode: input.dark_mode,
      block_ads: input.block_ads,
      block_cookie_banners: input.block_cookie_banners,
      quality: 85,
      ...(input.format === "pdf" ? { pdf_format: input.pdf_format, pdf_print_background: true } : {}),
    });

    const result = await render(renderOptions);

    if (authCtx) {
      const { userId, apiKeyId } = authCtx;
      logScreenshotUsage({
        userId,
        apiKeyId: apiKeyId ?? undefined,
        endpoint: "/api/tools/capture",
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
        endpoint: "/api/tools/capture",
        method: "POST",
        status: 200,
        ms: Date.now() - startTime,
        cached: false,
        url: input.url,
      }).catch(() => {});
    }

    const ext = input.format === "jpeg" ? "jpg" : input.format;
    const contentType = input.format === "pdf" ? "application/pdf" : `image/${input.format}`;

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": result.buffer.length.toString(),
        "Content-Disposition": `inline; filename="${getFilename(input.url, ext)}"`,
        "X-Free-Tool": "1",
        ...rateLimitHeadersObj,
      },
    });
  } catch (error) {
    return internalError(error, requestId);
  }
}
