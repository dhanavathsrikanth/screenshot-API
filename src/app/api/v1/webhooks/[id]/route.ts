import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/api-auth";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import {
  WebhookEndpointUpdateSchema,
  updateEndpoint,
  deleteEndpoint,
  listDeliveries,
} from "@/lib/webhooks";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

    const supabase = createServiceClient();
    const { data: endpoint } = await supabase
      .from("webhook_endpoints")
      .select("*")
      .eq("id", id)
      .eq("user_id", authCtx.userId)
      .maybeSingle();

    if (!endpoint) {
      return v1Err(404, "not_found", "Webhook endpoint not found.", requestId);
    }

    const deliveries = await listDeliveries(authCtx.userId, id, 25);
    return v1Ok({
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      is_active: endpoint.is_active,
      project_id: endpoint.project_id,
      created_at: endpoint.created_at,
      updated_at: endpoint.updated_at,
      deliveries: deliveries.map(({ id: deliveryId, event, status, attempts, http_status, error, created_at, sent_at }) => ({
        id: deliveryId,
        event,
        status,
        attempts,
        http_status,
        error,
        created_at,
        sent_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

    const body = await request.json().catch(() => ({}));
    const parsed = WebhookEndpointUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return v1Err(400, "invalid_parameters", "Invalid parameters.", requestId, parsed.error.flatten());
    }

    const { endpoint, secret } = await updateEndpoint({
      id,
      userId: authCtx.userId,
      url: parsed.data.url,
      events: parsed.data.events,
      isActive: parsed.data.is_active,
      rotateSecret: parsed.data.rotate_secret,
    });

    return v1Ok({
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      is_active: endpoint.is_active,
      project_id: endpoint.project_id,
      created_at: endpoint.created_at,
      updated_at: endpoint.updated_at,
      ...(secret !== undefined ? { signing_secret: secret } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

    const supabase = createServiceClient();
    const { data: endpoint } = await supabase
      .from("webhook_endpoints")
      .select("id")
      .eq("id", id)
      .eq("user_id", authCtx.userId)
      .maybeSingle();
    if (!endpoint) {
      return v1Err(404, "not_found", "Webhook endpoint not found.", requestId);
    }

    await deleteEndpoint(id, authCtx.userId);
    return v1Ok({ id, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
