import { NextResponse } from "next/server";
import { rateLimitHeaders, type RateLimitInfo } from "@/lib/api";

/**
 * v1 response envelope:
 *  - Success: { success: true,  data: ... }
 *  - Error:   { success: false, error: { code, message, details?, requestId? } }
 */

function requestIdHeaders(requestId?: string): Record<string, string> {
  return requestId ? { "x-request-id": requestId } : {};
}

export function v1Ok(
  data: unknown,
  init?: { status?: number; headers?: Record<string, string>; requestId?: string }
): NextResponse {
  return NextResponse.json(
    { success: true, data },
    {
      status: init?.status ?? 200,
      headers: { ...(init?.headers ?? {}), ...requestIdHeaders(init?.requestId) },
    }
  );
}

export function v1Err(
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        ...(requestId ? { requestId } : {}),
      },
    },
    { status, headers: requestIdHeaders(requestId) }
  );
}

export function v1RateLimited(retryAfterMs: number, info?: RateLimitInfo, requestId?: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "rate_limited",
        message: "Rate limit exceeded. Try again later.",
        retryAfterMs,
        ...(requestId ? { requestId } : {}),
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
        ...(info ? rateLimitHeaders(info) : {}),
        ...requestIdHeaders(requestId),
      },
    }
  );
}
