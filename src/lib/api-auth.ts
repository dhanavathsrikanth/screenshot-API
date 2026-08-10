import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";

export type AuthContext = {
  userId: string;
  apiKeyId: string | null;
  source: "app" | "api";
};

type VerifyApiKeyRow = {
  valid: boolean;
  api_key_id: string | null;
  user_id: string | null;
  error: string | null;
};

async function verifyApiKey(apiKey: string): Promise<{ userId: string; apiKeyId: string } | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("verify_api_key", { p_api_key: apiKey });
    if (error) return null;

    const row = Array.isArray(data) ? (data[0] as VerifyApiKeyRow | undefined) : (data as VerifyApiKeyRow | null);
    if (row?.valid && row.user_id) {
      return { userId: row.user_id, apiKeyId: row.api_key_id ?? "" };
    }
    return null;
  } catch {
    return null;
  }
}

function extractApiKey(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization && authorization.startsWith("Bearer ")) {
    const key = authorization.slice(7).trim();
    if (key) return key;
  }
  const apiKeyHeader = request.headers.get("x-api-key");
  return apiKeyHeader?.trim() || null;
}

/**
 * Resolve who is making an API request.
 *  1. Valid API key (`Authorization: Bearer <key>` or `x-api-key`) → the owning user.
 *  2. Active Clerk session (dashboard/playground) → the signed-in user.
 * Returns null when the request is anonymous or carries an invalid key.
 */
export async function resolveAuth(request: NextRequest): Promise<AuthContext | null> {
  const apiKey = extractApiKey(request);
  if (apiKey) {
    const verified = await verifyApiKey(apiKey);
    if (!verified) return null;
    return { userId: verified.userId, apiKeyId: verified.apiKeyId, source: "api" };
  }

  try {
    const { userId } = await auth();
    if (userId) return { userId, apiKeyId: null, source: "app" };
  } catch {
    // no active session
  }

  return null;
}
