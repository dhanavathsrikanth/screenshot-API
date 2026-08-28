"use server";

import { auth } from "@clerk/nextjs/server";
import {
  createScreenshotShare,
  revokeScreenshotShare,
  shareUrlFor,
  MAX_SHARE_EXPIRY_DAYS,
} from "@/lib/shares";
import { createServiceClient } from "@/lib/supabase/server";

export type HistoryShareResult = {
  id: string;
  url: string;
  expires_at: string;
};

/** Create an expiring share link for a screenshot (7 days by default). */
export async function createHistoryShare(
  screenshotId: string,
  expiresInDays?: number
): Promise<HistoryShareResult> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const days = Math.min(Math.max(1, expiresInDays ?? 7), MAX_SHARE_EXPIRY_DAYS);
  const share = await createScreenshotShare({ userId, screenshotId, expiresInDays: days });
  return { id: share.id, url: shareUrlFor(share.token), expires_at: share.expires_at };
}

/** Revoke a share link. */
export async function revokeHistoryShare(shareId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await revokeScreenshotShare(userId, shareId);
}

/** List active share links for a screenshot. */
export async function listHistoryShares(
  screenshotId: string
): Promise<{ id: string; url: string; expires_at: string; created_at: string }[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const supabase = createServiceClient();

  // Join via screenshots to enforce ownership.
  const { data } = await supabase
    .from("screenshot_shares")
    .select("id, token, expires_at, created_at, screenshots!inner(user_id)")
    .eq("screenshot_id", screenshotId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  // Filter to this user's shares (PostgREST won't filter on joined columns).
  type JoinedRow = {
    id: string;
    token: string;
    expires_at: string;
    created_at: string;
    screenshots: { user_id: string }[] | { user_id: string } | null;
  };
  type OutRow = { id: string; token: string; expires_at: string; created_at: string };
  const rows = ((data ?? []) as JoinedRow[])
    .filter((r) => {
      const joined = r.screenshots;
      if (!joined) return false;
      const first = Array.isArray(joined) ? joined[0] : joined;
      return first?.user_id === userId;
    })
    .map((r) => ({ id: r.id, token: r.token, expires_at: r.expires_at, created_at: r.created_at })) as OutRow[];

  return rows.map((r) => ({
    id: r.id,
    url: shareUrlFor(r.token),
    expires_at: r.expires_at,
    created_at: r.created_at,
  }));
}
