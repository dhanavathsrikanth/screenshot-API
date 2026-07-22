import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

// ─── Cache Helpers ─────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    if (!client) return null;
    const data = await client.get<T>(key);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    await client.set(key, value, { ex: ttlSeconds });
  } catch {
    // Silently fail — cache is optional
  }
}

export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    const keys = await client.keys(pattern);
    if (keys.length > 0) await client.del(...keys);
  } catch {
    // Silently fail
  }
}

// ─── Request Log (Redis List) ──────────────────────────────────────────

export interface RequestLogEntry {
  ts: string;
  endpoint: string;
  method: string;
  status: number;
  ms: number;
  cached: boolean;
  url?: string;
}

const MAX_LOG_ENTRIES = 1000;

export async function logRequest(userId: string, entry: RequestLogEntry): Promise<void> {
  try {
    const client = getRedis();
    if (!client) return;
    const key = `rl:${userId}:requests`;
    await client.lpush(key, JSON.stringify(entry));
    await client.ltrim(key, 0, MAX_LOG_ENTRIES - 1);
    await client.expire(key, 60 * 60 * 24 * 30); // 30 days
  } catch {
    // Silently fail
  }
}

export async function getRequestLogs(userId: string, offset = 0, count = 50): Promise<RequestLogEntry[]> {
  try {
    const client = getRedis();
    if (!client) return [];
    const entries = await client.lrange<RequestLogEntry>(`rl:${userId}:requests`, offset, offset + count - 1);
    return entries ?? [];
  } catch {
    return [];
  }
}

export async function getRequestLogCount(userId: string): Promise<number> {
  try {
    const client = getRedis();
    if (!client) return 0;
    return await client.llen(`rl:${userId}:requests`);
  } catch {
    return 0;
  }
}
