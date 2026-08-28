import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/api-auth";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import {
  WebhookEndpointCreateSchema,
  listEndpoints,
  createEndpoint,
} from "@/lib/webhooks";

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

    const endpoints = await listEndpoints(authCtx.userId);
    return v1Ok({
      webhooks: endpoints.map(({ id, url, events, is_active, project_id, created_at, updated_at }) => ({
        id,
        url,
        events,
        is_active,
        project_id,
        created_at,
        updated_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const parsed = WebhookEndpointCreateSchema.safeParse(body);
    if (!parsed.success) {
      return v1Err(400, "invalid_parameters", "Invalid parameters.", requestId, parsed.error.flatten());
    }

    const { endpoint, secret } = await createEndpoint({
      userId: authCtx.userId,
      projectId: authCtx.projectId,
      url: parsed.data.url,
      events: parsed.data.events,
    });

    return v1Ok(
      {
        id: endpoint.id,
        url: endpoint.url,
        events: endpoint.events,
        is_active: endpoint.is_active,
        project_id: endpoint.project_id,
        secret,
        created_at: endpoint.created_at,
        updated_at: endpoint.updated_at,
        signing_secret: secret,
      },
      { status: 201, requestId }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
