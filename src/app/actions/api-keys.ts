"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkApiKeyLimit } from "@/lib/plans";
import { getOrCreateProject, verifyProjectOwnership } from "@/app/actions/projects";
import { trackServerEvent } from "@/lib/posthog";
import {
  newApiKeyPair,
  newAccessKey,
  newSigningSecret,
  signingSecretAad,
  type ApiKeyEnvironment,
} from "@/lib/api-keys";
import { encryptSecret } from "@/lib/crypto/secret-box";

export type { ApiKeyEnvironment } from "@/lib/api-keys";

export async function generateApiKey(
  name: string,
  environment: ApiKeyEnvironment = "production",
  projectId?: string,
  options?: { rateLimitPerMinute?: number; expiresInDays?: number }
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const limitCheck = await checkApiKeyLimit(userId);
  if (!limitCheck.allowed) {
    throw new Error(`API key limit reached (${limitCheck.limit}). Upgrade your plan to create more keys.`);
  }

  let resolvedProjectId = projectId ?? (await getOrCreateProject(userId));
  if (projectId) {
    const owned = await verifyProjectOwnership(userId, projectId);
    if (!owned) throw new Error("Project not found.");
    resolvedProjectId = projectId;
  }
  const supabase = createServiceClient();
  const { rawKey, prefix, keyHash } = newApiKeyPair(environment);
  const accessKey = newAccessKey(environment);
  const signingSecret = newSigningSecret();
  const expiresAt =
    options?.expiresInDays && options.expiresInDays > 0
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
  const rateLimit =
    options?.rateLimitPerMinute && options.rateLimitPerMinute > 0
      ? options.rateLimitPerMinute
      : null;

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      project_id: resolvedProjectId,
      name,
      key_prefix: prefix,
      key_hash: keyHash,
      environment,
      rate_limit: rateLimit,
      expires_at: expiresAt,
      access_key: accessKey,
      signing_secret_encrypted: encryptSecret(signingSecret, signingSecretAad(accessKey)),
    })
    .select("id, name, key_prefix, environment, rate_limit, expires_at, created_at, access_key")
    .single();

  if (error) throw error;

  // Activation funnel: api_key_created (blueprint §16).
  await trackServerEvent({
    userId,
    event: "api_key_created",
    properties: { key_id: data.id, environment, project_id: resolvedProjectId, source: "dashboard" },
  }).catch(() => {});

  return { ...data, rawKey, signingSecret };
}

export async function updateApiKeySettings(
  keyId: string,
  settings: {
    rateLimitPerMinute?: number | null;
    expiresInDays?: number | null;
    projectId?: string;
  }
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const patch: Record<string, unknown> = {};
  if (settings.rateLimitPerMinute !== undefined) {
    patch.rate_limit = settings.rateLimitPerMinute && settings.rateLimitPerMinute > 0
      ? settings.rateLimitPerMinute
      : null;
  }
  if (settings.expiresInDays !== undefined) {
    patch.expires_at =
      settings.expiresInDays === null || settings.expiresInDays <= 0
        ? null
        : new Date(Date.now() + settings.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  }
  if (settings.projectId !== undefined) {
    const owned = await verifyProjectOwnership(userId, settings.projectId);
    if (!owned) throw new Error("Project not found.");
    patch.project_id = settings.projectId;
  }

  if (Object.keys(patch).length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update(patch)
    .eq("id", keyId)
    .eq("user_id", userId);

  if (error) throw error;

  if (settings.projectId !== undefined) {
    await trackServerEvent({
      userId,
      event: "api_key_project_changed",
      properties: { key_id: keyId, project_id: settings.projectId },
    }).catch(() => {});
  }
}

export async function reassignApiKeyProject(keyId: string, projectId: string): Promise<void> {
  await updateApiKeySettings(keyId, { projectId });
}

export async function listApiKeys() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, environment, is_active, last_used_at, created_at, rate_limit, expires_at, project_id, access_key, signing_secret_encrypted")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => {
    const { signing_secret_encrypted, ...rest } = row as typeof row & { signing_secret_encrypted: string | null };
    return {
      ...rest,
      has_signing_secret: Boolean(signing_secret_encrypted),
    };
  });
}

export async function revokeApiKey(keyId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", userId);

  if (error) throw error;

  await trackServerEvent({
    userId,
    event: "api_key_revoked",
    properties: { key_id: keyId },
  }).catch(() => {});
}

export async function toggleApiKey(keyId: string, isActive: boolean) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: isActive })
    .eq("id", keyId)
    .eq("user_id", userId);

  if (error) throw error;

  await trackServerEvent({
    userId,
    event: "api_key_status_changed",
    properties: { key_id: keyId, is_active: isActive },
  }).catch(() => {});
}

export async function rotateSigningSecret(keyId: string): Promise<{ accessKey: string; signingSecret: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("api_keys")
    .select("id, access_key")
    .eq("id", keyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) throw new Error("API key not found.");

  const accessKey = (existing.access_key as string | null) || newAccessKey("production");
  const signingSecret = newSigningSecret();
  const { error } = await supabase
    .from("api_keys")
    .update({
      access_key: accessKey,
      signing_secret_encrypted: encryptSecret(signingSecret, signingSecretAad(accessKey)),
    })
    .eq("id", keyId)
    .eq("user_id", userId);
  if (error) throw error;

  return { accessKey, signingSecret };
}

