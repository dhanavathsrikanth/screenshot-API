import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Shared conventions for the public API:
 *  - Standard JSON error envelope: { error: { code, message, details?, requestId? } }
 *  - Standard rate-limit + credit response headers
 *  - Scheme-less URL normalization
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getRequestId(request: NextRequest): string | undefined {
  return request.headers.get("x-request-id") ?? undefined;
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        ...(requestId ? { requestId } : {}),
      },
    },
    { status }
  );
}

export function zodErrorResponse(error: ZodError, requestId?: string): NextResponse {
  return jsonError(400, "invalid_parameters", "Invalid parameters.", requestId, error.flatten());
}

export function invalidUrl(message = "Only http:// and https:// URLs are supported.", requestId?: string): NextResponse {
  return jsonError(400, "invalid_url", message, requestId);
}

export function missingTarget(requestId?: string): NextResponse {
  return jsonError(
    400,
    "missing_target",
    "Must provide url, html, or markdown parameter.",
    requestId
  );
}

export function unauthorized(requestId?: string): NextResponse {
  return jsonError(
    401,
    "unauthorized",
    "Authentication required. Sign in at /dashboard or include a valid API key via the Authorization: Bearer header.",
    requestId
  );
}

export function insufficientCredits(requestId?: string): NextResponse {
  return jsonError(
    402,
    "insufficient_credits",
    "No credits remaining. Upgrade or buy credits.",
    requestId
  );
}

export function featureUnavailable(message: string, requestId?: string): NextResponse {
  return jsonError(403, "plan_feature", message, requestId);
}

export function internalError(error: unknown, requestId?: string): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  return jsonError(500, "internal_error", message, requestId);
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfterMs?: number;
}

export function rateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(info.limit),
    "X-RateLimit-Remaining": String(Math.max(0, info.remaining)),
    "X-RateLimit-Reset": String(info.reset),
  };
}

export function rateLimited(
  retryAfterMs: number,
  info?: RateLimitInfo,
  requestId?: string,
  message = "Rate limit exceeded. Try again later."
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "rate_limited",
        message,
        retryAfterMs,
        ...(requestId ? { requestId } : {}),
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        ...(info ? rateLimitHeaders(info) : {}),
      },
    }
  );
}

/**
 * Prefix `https://` when a user-supplied URL has no scheme.
 * `example.com` → `https://example.com`; `http://x.com` and `ftp://x.com` are left untouched.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
