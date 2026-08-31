import { uploadWithFallback, type StorageUploadResult } from "@/lib/storage/fallback";
import { uploadToCustomerBucket, type StoredDestination } from "@/lib/storage/customer-upload";
import { isCustomerUploadAllowed, type PlanId } from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export type PersistResult = StorageUploadResult & {
  /** Public URL on the customer's bucket when a destination is configured. */
  customerUrl: string | null;
  /** Prefer this in API responses (customer CDN, else our store). */
  deliveryUrl: string | null;
};

async function loadDestination(projectId: string): Promise<StoredDestination | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("project_upload_destinations")
    .select(
      "project_id, user_id, provider, bucket, region, endpoint, access_key_id, secret_encrypted, public_url_prefix, path_prefix, force_path_style, enabled"
    )
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !data || data.enabled === false) return null;
  return data as StoredDestination;
}

/**
 * Store bytes in our R2/Supabase fallback, then copy to the project's
 * customer bucket when Pro+ destination is enabled. Capture success does
 * not depend on the customer copy.
 */
export async function persistCapture(
  buffer: Buffer,
  key: string,
  contentType: string,
  ctx: {
    userId?: string;
    projectId?: string | null;
    requestId?: string | null;
    sourceUrl?: string;
    plan?: PlanId;
  }
): Promise<PersistResult> {
  const primary = await uploadWithFallback(buffer, key, contentType, {
    userId: ctx.userId,
    requestId: ctx.requestId,
    sourceUrl: ctx.sourceUrl,
  });

  let customerUrl: string | null = null;
  if (ctx.projectId && ctx.plan && isCustomerUploadAllowed(ctx.plan)) {
    try {
      const dest = await loadDestination(ctx.projectId);
      if (dest) {
        const copied = await uploadToCustomerBucket(dest, buffer, key, contentType);
        customerUrl = copied.url;
      }
    } catch (e) {
      logger.error({
        event: "customer_upload_failed",
        requestId: ctx.requestId ?? undefined,
        projectId: ctx.projectId,
        error: e instanceof Error ? e.message : e,
      });
    }
  } else if (ctx.projectId && ctx.plan && !isCustomerUploadAllowed(ctx.plan)) {
    // Destination may still exist after a downgrade — never copy, never fail.
  }

  const deliveryUrl = customerUrl ?? primary.url;
  return { ...primary, customerUrl, deliveryUrl };
}
