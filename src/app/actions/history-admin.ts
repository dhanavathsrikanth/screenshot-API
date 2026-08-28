"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { deleteFromStorage, storageKeyFromUrl } from "@/lib/storage/uploader";

/**
 * Bulk-delete screenshots and their Cloudflare R2 objects. Rows and objects
 * that don't belong to the current user are silently skipped (no info leak).
 */
export async function deleteScreenshots(screenshotIds: string[]): Promise<{ deleted: number }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  if (!screenshotIds.length) return { deleted: 0 };

  const supabase = createServiceClient();

  const { data: rows, error: fetchErr } = await supabase
    .from("screenshots")
    .select("id, storage_url")
    .in("id", screenshotIds)
    .eq("user_id", userId);

  if (fetchErr) throw fetchErr;
  if (!rows?.length) return { deleted: 0 };

  // Delete R2 objects in parallel (best-effort; orphaned objects don't break anything).
  await Promise.allSettled(
    rows
      .map((r) => storageKeyFromUrl(r.storage_url))
      .filter((k): k is string => !!k)
      .map((key) => deleteFromStorage(key))
  );

  const ids = rows.map((r) => r.id);

  // Cascade: delete shares → screenshots. (The shares FK ON DELETE CASCADE will
  // handle this automatically when we delete the screenshots, but being explicit
  // keeps the intent clear and avoids relying on cascade for the storage cleanup
  // step above.)
  await supabase.from("screenshot_shares").delete().in("screenshot_id", ids);

  const { error: delErr } = await supabase
    .from("screenshots")
    .delete()
    .in("id", ids)
    .eq("user_id", userId);

  if (delErr) throw delErr;
  return { deleted: ids.length };
}

/**
 * Export the currently loaded history rows as a downloadable CSV. Reuses the
 * same filter logic server-side so the export always matches the visible table.
 */
export async function exportHistoryCsv(filters?: {
  format?: string;
  source?: string;
  query?: string;
  from?: string;
  to?: string;
}): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();

  let query = supabase
    .from("screenshots")
    .select("url, format, width, height, file_size_bytes, cached, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10_000);

  if (filters?.format && filters.format !== "all") {
    query = query.eq("format", filters.format.toLowerCase());
  }
  if (filters?.source === "api") {
    query = query.not("metadata->>method", "is", null);
  } else if (filters?.source === "playground") {
    query = query.is("metadata->>method", null);
  } else if (filters?.source === "cached") {
    query = query.eq("cached", true);
  }
  if (filters?.query) {
    query = query.ilike("url", `%${filters.query}%`);
  }
  if (filters?.from) {
    const from = new Date(filters.from);
    if (!Number.isNaN(from.getTime())) query = query.gte("created_at", from.toISOString());
  }
  if (filters?.to) {
    const to = new Date(filters.to);
    if (!Number.isNaN(to.getTime())) {
      const end = new Date(to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  const header = "url,format,width,height,size_bytes,cached,created_at,method,response_ms\n";
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = (data ?? []).map((r) => {
    const meta = (r.metadata ?? {}) as { method?: string; response_time_ms?: number };
    return [
      r.url ?? "",
      r.format,
      r.width ?? "",
      r.height ?? "",
      r.file_size_bytes ?? "",
      r.cached ? "true" : "false",
      r.created_at,
      meta.method ?? "",
      meta.response_time_ms ?? "",
    ]
      .map(String)
      .map(escape)
      .join(",");
  });

  return header + rows.join("\n");
}
