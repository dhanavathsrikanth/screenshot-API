"use server";

import { auth } from "@clerk/nextjs/server";
import { getScreenshotHistory, type HistoryFilterParams } from "@/app/actions/usage";
import type { ScreenshotRow } from "@/lib/history-types";

/**
 * Client-callable pagination for the history page's "Load more" button.
 * Resolves the user from the Clerk session so the client never supplies a
 * user id. Kept in its own "use server" file so importing it doesn't drag
 * server-only modules into client components that only need the types.
 */
export async function loadMoreHistory(
  before: string | undefined,
  filters?: HistoryFilterParams
): Promise<ScreenshotRow[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getScreenshotHistory(userId, { limit: 50, before, filters });
}
