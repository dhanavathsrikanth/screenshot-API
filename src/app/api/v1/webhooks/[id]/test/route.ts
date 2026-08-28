import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/api-auth";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { testEndpointDelivery } from "@/lib/webhooks";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const { id } = await ctx.params;
    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }

    const deliveryId = await testEndpointDelivery(authCtx.userId, id);
    return v1Ok(
      {
        delivery_id: deliveryId,
        message: "Test delivery queued. Poll GET /api/v1/webhooks/{id} to check its status.",
      },
      { status: 202, requestId }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Webhook endpoint not found.") {
      return v1Err(404, "not_found", message, requestId);
    }
    return v1Err(500, "internal_error", message, requestId);
  }
}
