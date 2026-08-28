import { createServiceClient } from "@/lib/supabase/server";
import { deleteFromStorage, storageKeyFromUrl } from "@/lib/storage/uploader";
import { getUserPlan, getPlanLimits, RETENTION_TIERS_DAYS } from "@/lib/plans";
import { logger } from "@/lib/logger";

/**
 * Retention enforcement (privacy policy §4): rendered screenshots are stored
 * for a plan-dependent window — 24h on Free, 30 days on Starter, 90 days on
 * Pro/Scale — then the R2 object and the history row are deleted. Request
 * metadata (api_key_logs / usage_events / screenshot_jobs) is kept for
 * billing and abuse prevention.
 *
 * The sweep walks each retention tier oldest-first: a row is deleted at the
 * smallest tier whose window covers its owner's plan retention.
 */

const BATCH_SIZE = 200;
const MAX_BATCHES_PER_TIER = 10;

export async function purgeExpiredScreenshots(): Promise<{ deleted: number }> {
  const supabase = createServiceClient();
  let deleted = 0;

  for (const tier of RETENTION_TIERS_DAYS) {
    const cutoff = new Date(Date.now() - tier * 24 * 60 * 60 * 1000).toISOString();

    for (let batch = 0; batch < MAX_BATCHES_PER_TIER; batch++) {
      const { data, error } = await supabase
        .from("screenshots")
        .select("id, user_id, storage_url")
        .lt("created_at", cutoff)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);
      if (error) {
        logger.error({ event: "retention_query_failed", tier, error: error.message });
        break;
      }
      if (!data || data.length === 0) break;

      const planCache = new Map<string, number>();
      const doomed: { id: string; storage_url: string | null }[] = [];
      for (const row of data) {
        let retention = planCache.get(row.user_id);
        if (retention === undefined) {
          retention = getPlanLimits(await getUserPlan(row.user_id)).retentionDays;
          planCache.set(row.user_id, retention);
        }
        if (retention <= tier) doomed.push(row);
      }

      if (doomed.length > 0) {
        await Promise.all(
          doomed.map(async (row) => {
            const key = row.storage_url ? storageKeyFromUrl(row.storage_url) : null;
            if (!key) return;
            try {
              await deleteFromStorage(key);
            } catch (e) {
              logger.error({ event: "retention_storage_delete_failed", screenshotId: row.id, error: e instanceof Error ? e.message : e });
            }
          })
        );
        const { error: delError } = await supabase
          .from("screenshots")
          .delete()
          .in("id", doomed.map((r) => r.id));
        if (delError) {
          logger.error({ event: "retention_row_delete_failed", tier, error: delError.message });
          break;
        }
        deleted += doomed.length;
      }

      // Only stop early when this tier's window is exhausted; a full batch
      // means more candidates may follow.
      if ((data?.length ?? 0) < BATCH_SIZE) break;
    }
  }

  return { deleted };
}
