import { uploadToStorage, deleteFromStorage, storageKeyFromUrl } from "@/lib/storage/uploader";
import {
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
  supabaseStorageKeyFromUrl,
} from "@/lib/storage/supabase-uploader";
import { notifyStorageFallback } from "@/app/actions/admin-notifications";
import { logger } from "@/lib/logger";

export type StorageUploadResult = {
  /** Public URL of the stored object, or null when every store failed. */
  url: string | null;
  /** Which store actually holds the object. */
  source: "r2" | "supabase" | "none";
  /** Exact error message from the failed primary (R2) upload, if any. */
  error?: string;
};

/**
 * Delete a stored screenshot object wherever it lives (Cloudflare R2 or the
 * Supabase Storage fallback). No-op for URLs we don't own. Use this instead of
 * `deleteFromStorage` directly so fallback objects are cleaned up too.
 */
export async function deleteStorageObjectByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;

  const r2Key = storageKeyFromUrl(url);
  if (r2Key) {
    await deleteFromStorage(r2Key);
    return;
  }

  const supabaseKey = supabaseStorageKeyFromUrl(url);
  if (supabaseKey) {
    await deleteFromSupabaseStorage(supabaseKey);
  }
}

/**
 * Upload a screenshot buffer to Cloudflare R2 (primary). If that fails, fall
 * back to Supabase Storage so the capture is never lost, and surface the
 * failure + exact error to the admin panel. Returns null only if both stores
 * fail (in which case a secondary alert is also raised).
 */
export async function uploadWithFallback(
  buffer: Buffer,
  key: string,
  contentType: string,
  ctx: { userId?: string; requestId?: string | null; sourceUrl?: string }
): Promise<StorageUploadResult> {
  try {
    const url = await uploadToStorage(buffer, key, contentType);
    return { url, source: "r2" };
  } catch (r2Raw) {
    const r2Error = r2Raw instanceof Error ? r2Raw.message : String(r2Raw);
    logger.error({
      event: "take_upload_failed_r2",
      requestId: ctx.requestId ?? undefined,
      error: r2Error,
    });

    try {
      const url = await uploadToSupabaseStorage(buffer, key, contentType);
      await notifyStorageFallback({
        type: "storage",
        severity: "warning",
        title: "R2 upload failed — fell back to Supabase Storage",
        message: `A screenshot for ${ctx.sourceUrl ?? "unknown URL"} was stored in Supabase Storage because the Cloudflare R2 upload failed.`,
        metadata: {
          reason: "r2_upload_failed",
          fallback_storage: "supabase",
          failed_storage: "r2",
          error: r2Error,
          url,
          sourceUrl: ctx.sourceUrl ?? null,
          requestId: ctx.requestId ?? null,
        },
        userId: ctx.userId,
      }).catch(() => {});
      return { url, source: "supabase", error: r2Error };
    } catch (supabaseRaw) {
      const supabaseError =
        supabaseRaw instanceof Error ? supabaseRaw.message : String(supabaseRaw);
      logger.error({
        event: "take_upload_failed_all",
        requestId: ctx.requestId ?? undefined,
        error: supabaseError,
      });

      await notifyStorageFallback({
        type: "storage",
        severity: "critical",
        title: "Screenshot storage failure (R2 AND Supabase)",
        message: `A screenshot for ${ctx.sourceUrl ?? "unknown URL"} could not be stored anywhere. The capture was returned but has no storage record.`,
        metadata: {
          reason: "all_storage_failed",
          failed_storage: "r2,supabase",
          error: r2Error,
          secondary_error: supabaseError,
          sourceUrl: ctx.sourceUrl ?? null,
          requestId: ctx.requestId ?? null,
        },
        userId: ctx.userId,
      }).catch(() => {});
      return { url: null, source: "none", error: r2Error };
    }
  }
}
