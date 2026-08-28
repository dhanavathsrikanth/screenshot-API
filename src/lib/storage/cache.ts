import { createHash } from "node:crypto";
import { cacheGet, cacheSet } from "@/lib/redis";

// Parameters that vary per request but don't affect visual output — excluded
// from the cache key so identical-looking screenshots share a single entry.
const UNSTABLE_PARAMS = [
  "delay",
  "timeout",
  "wait_until",
  "full_page_scroll_by",
  "full_page_scroll_delay",
];

// TTL (seconds) per plan. Configurable per plan so paid tiers can keep
// screenshots fresh for longer without hardcoding anything in the renderer.
export function cacheTtlForPlan(plan: string): number {
  return plan === "free" ? 3600 : 86400;
}

export interface CacheEntry {
  storageUrl: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

function filterUnstableParams(options: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (!UNSTABLE_PARAMS.includes(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export function getCacheKey(options: Record<string, unknown>): string {
  const stableOptions = filterUnstableParams(options);
  const hash = createHash("sha256")
    .update(JSON.stringify(stableOptions))
    .digest("hex");
  return `ss:${hash}`;
}

export async function getFromCache(key: string): Promise<CacheEntry | null> {
  return cacheGet<CacheEntry>(key);
}

/**
 * Store only the R2 object URL + metadata — never the image bytes. The cached
 * screenshot is served straight from R2, so Redis stays small and cheap.
 */
export async function setInCache(key: string, entry: CacheEntry, plan: string): Promise<void> {
  if (!entry.storageUrl) return;
  await cacheSet(key, entry, cacheTtlForPlan(plan));
}
