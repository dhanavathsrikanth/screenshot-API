import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/api-auth";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { replayDelivery } from "@/lib/webhooks";

export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ deliveryId: string }> }) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const { deliveryId } = await ctx.params;
    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }

    await replayDelivery(authCtx.userId, deliveryId);
    return v1Ok({ id: deliveryId, replayed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Delivery not found.") {
      return v1Err(404, "not_found", message, requestId);
    }
    if (message.startsWith("Delivery is currently")) {
      return v1Err(409, "conflict", message, requestId);
    }
    return v1Err(500, "internal_error", message, requestId);
  }
}
