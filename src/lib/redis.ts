import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Cache Helpers ─────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<T>(key);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // Silently fail — cache is optional
  }
}

export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
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
    const key = `rl:${userId}:requests`;
    await redis.lpush(key, JSON.stringify(entry));
    await redis.ltrim(key, 0, MAX_LOG_ENTRIES - 1);
    await redis.expire(key, 60 * 60 * 24 * 30); // 30 days
  } catch {
    // Silently fail
  }
}

export async function getRequestLogs(userId: string, offset = 0, count = 50): Promise<RequestLogEntry[]> {
  try {
    const entries = await redis.lrange<RequestLogEntry>(`rl:${userId}:requests`, offset, offset + count - 1);
    return entries ?? [];
  } catch {
    return [];
  }
}

export async function getRequestLogCount(userId: string): Promise<number> {
  try {
    return await redis.llen(`rl:${userId}:requests`);
  } catch {
    return 0;
  }
}
