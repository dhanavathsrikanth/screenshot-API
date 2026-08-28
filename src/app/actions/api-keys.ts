"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { checkApiKeyLimit } from "@/lib/plans";
import { getOrCreateProject } from "@/app/actions/projects";
import { trackServerEvent } from "@/lib/posthog";
import {
  newApiKeyPair,
  type ApiKeyEnvironment,
} from "@/lib/api-keys";

export type { ApiKeyEnvironment } from "@/lib/api-keys";

export async function generateApiKey(
  name: string,
  environment: ApiKeyEnvironment = "production",
  projectId?: string
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const limitCheck = await checkApiKeyLimit(userId);
  if (!limitCheck.allowed) {
    throw new Error(`API key limit reached (${limitCheck.limit}). Upgrade your plan to create more keys.`);
  }

  const supabase = await createClient();
  const resolvedProjectId = projectId ?? (await getOrCreateProject(userId));
  const { rawKey, prefix, keyHash } = newApiKeyPair(environment);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      project_id: resolvedProjectId,
      name,
      key_prefix: prefix,
      key_hash: keyHash,
      environment,
    })
    .select("id, name, key_prefix, environment, created_at")
    .single();

  if (error) throw error;

  // Activation funnel: api_key_created (blueprint §16).
  await trackServerEvent({
    userId,
    event: "api_key_created",
    properties: { key_id: data.id, environment, project_id: resolvedProjectId, source: "dashboard" },
  }).catch(() => {});

  return { ...data, rawKey };
}

export async function listApiKeys() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, environment, is_active, last_used_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
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
