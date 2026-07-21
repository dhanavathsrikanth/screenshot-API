import { createHash } from "node:crypto";
import { redis } from "@/lib/redis";

// Unstable parameters that vary per request but don't affect visual output
const UNSTABLE_PARAMS = [
  "delay",
  "timeout",
  "wait_until",
  "full_page_scroll_by",
  "full_page_scroll_delay",
];

const CACHE_TTL_SECONDS = 3600; // 1 hour

/**
 * Filter out unstable parameters from options before generating cache key
 */
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
  // Filter out unstable params before hashing
  const stableOptions = filterUnstableParams(options);
  const hash = createHash("md5")
    .update(JSON.stringify(stableOptions))
    .digest("hex");
  return `ss:${hash}`;
}

export async function getFromCache(
  key: string
): Promise<{ buffer: Buffer; metadata: Record<string, unknown> } | null> {
  try {
    const cached = await redis.get<{ buffer: string; metadata: Record<string, unknown> }>(key);
    if (cached) {
      return {
        buffer: Buffer.from(cached.buffer, "base64"),
        metadata: cached.metadata,
      };
    }
    return null;
  } catch {
    // Redis unavailable - fail silently, allow request to proceed
    return null;
  }
}

export async function setInCache(
  key: string,
  buffer: Buffer,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await redis.set(
      key,
      {
        buffer: buffer.toString("base64"),
        metadata,
      },
      { ex: CACHE_TTL_SECONDS }
    );
  } catch {
    // Redis unavailable - fail silently, allow request to proceed without caching
  }
}