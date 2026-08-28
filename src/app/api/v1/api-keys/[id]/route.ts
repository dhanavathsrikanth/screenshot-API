import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAuth } from "@/lib/api-auth";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { createServiceClient } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/posthog";

export const maxDuration = 60;

const ApiKeyUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  is_active: z.boolean().optional(),
  /** Per-key requests/minute override; 0 or null clears it (plan default). */
  rate_limit_per_minute: z.coerce.number().int().min(0).max(10_000).nullable().optional(),
  /** Days from now until expiry; null clears expiry. */
  expires_in_days: z.coerce.number().int().min(1).max(365).nullable().optional(),
});

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
    const parsed = ApiKeyUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return v1Err(400, "invalid_parameters", "Invalid parameters.", requestId, parsed.error.flatten());
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
    if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;
    if (parsed.data.rate_limit_per_minute !== undefined) {
      patch.rate_limit = parsed.data.rate_limit_per_minute || null;
    }
    if (parsed.data.expires_in_days !== undefined) {
      patch.expires_at =
        parsed.data.expires_in_days === null
          ? null
          : new Date(Date.now() + parsed.data.expires_in_days * 24 * 60 * 60 * 1000).toISOString();
    }

    if (Object.keys(patch).length === 0) {
      return v1Err(400, "invalid_parameters", "No updatable fields provided.", requestId);
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("api_keys")
      .update(patch)
      .eq("id", id)
      .eq("user_id", authCtx.userId)
      .select("id, name, key_prefix, environment, is_active, rate_limit, expires_at")
      .single();

    if (error) {
      return v1Err(404, "not_found", "API key not found.", requestId);
    }

    return v1Ok({
      id: data.id,
      name: data.name,
      key_prefix: data.key_prefix,
      environment: data.environment,
      is_active: data.is_active,
      rate_limit_per_minute: data.rate_limit,
      expires_at: data.expires_at,
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
    const { data, error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", id)
      .eq("user_id", authCtx.userId)
      .select("id");

    if (error) {
      return v1Err(500, "internal_error", error.message, requestId);
    }

    if (!data || data.length === 0) {
      return v1Err(404, "not_found", "API key not found.", requestId);
    }

    await trackServerEvent({
      userId: authCtx.userId,
      event: "api_key_revoked",
      properties: { key_id: id, source: "api" },
    }).catch(() => {});

    return v1Ok({ id, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
