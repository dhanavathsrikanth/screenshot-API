import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto/secret-box";
import { verifySignedQuery } from "@/lib/signed-url";
import { signingSecretAad } from "@/lib/api-keys";

export type AuthContext = {
  userId: string;
  apiKeyId: string | null;
  projectId: string | null;
  source: "app" | "api";
  /** Per-key requests/min override from api_keys.rate_limit; null = plan default. */
  apiKeyRateLimit?: number | null;
};

type VerifyApiKeyRow = {
  valid: boolean;
  api_key_id: string | null;
  user_id: string | null;
  project_id: string | null;
  error: string | null;
  rate_limit: number | null;
};

async function verifyApiKey(apiKey: string): Promise<{
  userId: string;
  apiKeyId: string;
  projectId: string | null;
  rateLimit: number | null;
} | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("verify_api_key", { p_api_key: apiKey });
    if (error) return null;

    const row = Array.isArray(data) ? (data[0] as VerifyApiKeyRow | undefined) : (data as VerifyApiKeyRow | null);
    if (row?.valid && row.user_id) {
      return {
        userId: row.user_id,
        apiKeyId: row.api_key_id ?? "",
        projectId: row.project_id ?? null,
        rateLimit: row.rate_limit ?? null,
      };
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
  if (apiKeyHeader?.trim()) return apiKeyHeader.trim();
  // ScreenshotOne-style GET: ?access_key=xxx or ?api_key=xxx or ?key=xxx (like https://api.screenshotone.com/take?access_key=...&url=...)
  const qp = request.nextUrl.searchParams;
  const qKey = qp.get("access_key") || qp.get("api_key") || qp.get("key") || qp.get("apikey");
  if (qKey?.trim()) return qKey.trim();
  return null;
}

export type SignedAuthFailure = "missing" | "expired" | "bad_signature" | "unknown_key";

async function resolveSignedQuery(
  request: NextRequest
): Promise<{ ok: true; ctx: AuthContext } | { ok: false; reason: SignedAuthFailure } | null> {
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  if (!params.access_key && !params.signature) return null;
  if (!params.access_key || !params.signature) {
    return { ok: false, reason: "missing" };
  }

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("api_keys")
    .select("id, user_id, project_id, rate_limit, expires_at, revoked_at, is_active, signing_secret_encrypted, access_key")
    .eq("access_key", params.access_key.trim())
    .maybeSingle();

  if (
    !data ||
    !data.is_active ||
    data.revoked_at ||
    (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) ||
    !data.signing_secret_encrypted
  ) {
    return { ok: false, reason: "unknown_key" };
  }

  let signingSecret: string;
  try {
    signingSecret = decryptSecret(data.signing_secret_encrypted, signingSecretAad(data.access_key));
  } catch {
    return { ok: false, reason: "unknown_key" };
  }

  const verified = verifySignedQuery(params, signingSecret);
  if (!verified.ok) {
    return { ok: false, reason: verified.reason === "expired" ? "expired" : verified.reason === "missing" ? "missing" : "bad_signature" };
  }

  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return {
    ok: true,
    ctx: {
      userId: data.user_id as string,
      apiKeyId: data.id as string,
      projectId: (data.project_id as string | null) ?? null,
      source: "api",
      apiKeyRateLimit: (data.rate_limit as number | null) ?? null,
    },
  };
}

/**
 * Auth for GET /api/take: Bearer key, then HMAC-signed query, then Clerk session.
 */
export async function resolveTakeAuth(
  request: NextRequest
): Promise<{ ctx: AuthContext } | { signedFailure: SignedAuthFailure } | null> {
  const apiKey = extractApiKey(request);
  if (apiKey) {
    const verified = await verifyApiKey(apiKey);
    if (!verified) return null;
    return {
      ctx: {
        userId: verified.userId,
        apiKeyId: verified.apiKeyId,
        projectId: verified.projectId,
        source: "api",
        apiKeyRateLimit: verified.rateLimit,
      },
    };
  }

  const signed = await resolveSignedQuery(request);
  if (signed) {
    if (signed.ok) return { ctx: signed.ctx };
    return { signedFailure: signed.reason };
  }

  const session = await resolveAuth(request);
  if (session) return { ctx: session };
  return null;
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
    return {
      userId: verified.userId,
      apiKeyId: verified.apiKeyId,
      projectId: verified.projectId,
      source: "api",
      apiKeyRateLimit: verified.rateLimit,
    };
  }

  // Clerk's `auth()` can throw transiently (e.g. a session-token refresh that
  // needs a network round-trip to Clerk, or a mid-flight JWT decode hiccup).
  // A single transient failure must not 401 a legitimately signed-in dashboard
  // user, so retry once before concluding there is no active session.
  let authError: Error | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { userId } = await auth();
      if (userId) return { userId, apiKeyId: null, projectId: null, source: "app" };
      // No throw, but also no userId → break (genuinely not signed in)
      break;
    } catch (e) {
      authError = e instanceof Error ? e : undefined;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 120));
    }
  }

  const requestId = request.headers.get("x-request-id");
  logger.warn({
    event: "auth_resolve_failed",
    reason: authError ? "clerk_auth_thrown" : "no_user_id",
    attempt: authError ? 2 : 1,
    requestId: requestId ?? undefined,
    path: request.nextUrl.pathname,
    error: authError?.message,
  });

  return null;
}
