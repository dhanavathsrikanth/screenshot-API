import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAuth } from "@/lib/api-auth";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { checkApiKeyLimit } from "@/lib/plans";
import { getOrCreateProject } from "@/app/actions/projects";
import { trackServerEvent } from "@/lib/posthog";
import { createServiceClient } from "@/lib/supabase/server";
import { KEY_ENVIRONMENTS, newApiKeyPair, type ApiKeyEnvironment } from "@/lib/api-keys";

export const maxDuration = 60;

const ApiKeyCreateSchema = z.object({
  name: z.string().min(1).max(80),
  environment: z.enum(KEY_ENVIRONMENTS).default("production"),
  project_id: z.string().min(1).max(128).optional(),
  /** Per-key requests/minute override on top of the plan limit. Omit or 0 = plan default. */
  rate_limit_per_minute: z.coerce.number().int().min(0).max(10_000).optional(),
  /** Key auto-expires after this many days. Omit = never expires. */
  expires_in_days: z.coerce.number().int().min(1).max(365).optional(),
});

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

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, environment, is_active, last_used_at, created_at, project_id, rate_limit, expires_at")
      .eq("user_id", authCtx.userId)
      .order("created_at", { ascending: false });

    if (error) {
      return v1Err(500, "internal_error", error.message, requestId);
    }

    return v1Ok({ api_keys: data ?? [] });
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
    const parsed = ApiKeyCreateSchema.safeParse(body);
    if (!parsed.success) {
      return v1Err(400, "invalid_parameters", "Invalid parameters.", requestId, parsed.error.flatten());
    }

    const input = parsed.data;
    const limitCheck = await checkApiKeyLimit(authCtx.userId);
    if (!limitCheck.allowed) {
      return v1Err(
        403,
        "plan_feature",
        `API key limit reached (${limitCheck.limit}). Upgrade your plan to create more keys.`,
        requestId
      );
    }

    const supabase = createServiceClient();
    const resolvedProjectId = input.project_id ?? (await getOrCreateProject(authCtx.userId));
    const environment: ApiKeyEnvironment = input.environment;
    const { rawKey, prefix, keyHash } = newApiKeyPair(environment);
    const expiresAt = input.expires_in_days
      ? new Date(Date.now() + input.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: authCtx.userId,
        project_id: resolvedProjectId,
        name: input.name.trim(),
        key_prefix: prefix,
        key_hash: keyHash,
        environment,
        rate_limit: input.rate_limit_per_minute ?? null,
        expires_at: expiresAt,
      })
      .select("id, name, key_prefix, environment, is_active, created_at, project_id, rate_limit, expires_at")
      .single();

    if (error) {
      return v1Err(500, "internal_error", error.message, requestId);
    }

    await trackServerEvent({
      userId: authCtx.userId,
      event: "api_key_created",
      properties: { key_id: data.id, name: input.name, environment, project_id: resolvedProjectId, source: "api" },
    }).catch(() => {});

    return v1Ok(
      {
        id: data.id,
        name: data.name,
        key_prefix: data.key_prefix,
        environment: data.environment,
        project_id: data.project_id,
        is_active: data.is_active,
        rate_limit_per_minute: data.rate_limit,
        expires_at: data.expires_at,
        created_at: data.created_at,
        key: rawKey,
      },
      { status: 201, requestId }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
