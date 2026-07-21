"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";
import { createHash, randomBytes } from "crypto";
import { checkApiKeyLimit } from "@/lib/plans";

function hashApiKey(key: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + key).digest("hex");
  return `${salt}:${hash}`;
}

export async function generateApiKey(name: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const limitCheck = await checkApiKeyLimit(userId);
  if (!limitCheck.allowed) {
    throw new Error(`API key limit reached (${limitCheck.limit}). Upgrade your plan to create more keys.`);
  }

  const supabase = await createClient();
  const rawKey = `st_${nanoid(48)}`;
  const prefix = rawKey.slice(0, 7);
  const keyHash = hashApiKey(rawKey);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      name,
      key_prefix: prefix,
      key_hash: keyHash,
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) throw error;
  return { ...data, rawKey };
}

export async function listApiKeys() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, is_active, last_used_at, created_at")
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
}
