import { nanoid } from "nanoid";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Expiring share links for individual screenshots. A share is a random
 * opaque token that /api/share/[token] resolves to a 302 redirect of the
 * underlying R2 object — the storage URL itself stays unlisted but public,
 * so tokens are capability URLs with a hard expiry.
 */

export const SHARE_TOKEN_LENGTH = 32;
/** Upper bound for link lifetime, in days. */
export const MAX_SHARE_EXPIRY_DAYS = 30;

export type ShareRow = {
  id: string;
  token: string;
  screenshot_id: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export function shareUrlFor(token: string): string {
  return `/api/share/${token}`;
}

export async function createScreenshotShare(params: {
  userId: string;
  screenshotId: string;
  expiresInDays?: number;
}): Promise<ShareRow> {
  const supabase = createServiceClient();

  // Ownership check before minting a capability URL.
  const { data: screenshot } = await supabase
    .from("screenshots")
    .select("id")
    .eq("id", params.screenshotId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (!screenshot) throw new Error("Screenshot not found.");

  const days = Math.min(Math.max(1, params.expiresInDays ?? 7), MAX_SHARE_EXPIRY_DAYS);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("screenshot_shares")
    .insert({
      token: nanoid(SHARE_TOKEN_LENGTH),
      screenshot_id: params.screenshotId,
      user_id: params.userId,
      expires_at: expiresAt,
    })
    .select("id, token, screenshot_id, expires_at, revoked_at, created_at")
    .single();
  if (error) throw error;
  return data as ShareRow;
}

export async function revokeScreenshotShare(userId: string, shareId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("screenshot_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Resolve a token to the screenshot's storage URL, or null when invalid/expired/revoked. */
export async function resolveShareToken(token: string): Promise<string | null> {
  if (!token || token.length > 128) return null;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("screenshot_shares")
    .select("expires_at, revoked_at, screenshots(storage_url)")
    .eq("token", token)
    .maybeSingle();

  const row = data as unknown as
    | { expires_at: string; revoked_at: string | null; screenshots: { storage_url: string | null } | null }
    | null;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return row.screenshots?.storage_url ?? null;
}
