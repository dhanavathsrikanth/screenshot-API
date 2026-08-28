import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/api-auth";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { listDeliveries } from "@/lib/webhooks";

export const maxDuration = 60;

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
    const endpointId = url.searchParams.get("endpoint_id") ?? undefined;
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    const deliveries = await listDeliveries(authCtx.userId, endpointId, limit);
    return v1Ok({
      deliveries: deliveries.map(({ id, endpoint_id, event, status, attempts, http_status, error, next_retry_at, created_at, sent_at }) => ({
        id,
        endpoint_id,
        event,
        status,
        attempts,
        http_status,
        error,
        next_retry_at,
        created_at,
        sent_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
