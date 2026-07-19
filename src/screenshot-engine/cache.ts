import { createHash } from "node:crypto";

const cache = new Map<string, { buffer: Buffer; metadata: Record<string, unknown> }>();

export function getCacheKey(options: Record<string, unknown>): string {
  const hash = createHash("md5")
    .update(JSON.stringify(options))
    .digest("hex");
  return `ss:${hash}`;
}

export function getFromCache(key: string): { buffer: Buffer; metadata: Record<string, unknown> } | null {
  const cached = cache.get(key);
  if (cached) return cached;
  return null;
}

export function setInCache(
  key: string,
  buffer: Buffer,
  metadata: Record<string, unknown>
): void {
  cache.set(key, { buffer, metadata });
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
}
