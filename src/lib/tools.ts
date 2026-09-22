import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";
import { TOOL_GUEST_DAILY_LIMIT } from "@/lib/tool-limits";

function createLimiter(maxRequests: number, window: Duration, prefix: string): Ratelimit {
  const client = getRedis();
  if (!client) {
    // No-op limiter when Redis is unavailable — never blocks the free tool
    return {
      limit: async () => ({ success: true, limit: maxRequests, remaining: maxRequests, reset: Date.now() + 86400000 }),
    } as unknown as Ratelimit;
  }
  return new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    analytics: true,
    prefix,
  });
}

let dailyLimiter: Ratelimit | null = null;

type LocalGuestCounter = { dayStartedAt: number; dayCount: number };
const localGuestCounters = new Map<string, LocalGuestCounter>();

function localGuestLimit(clientId: string, ip: string): GuestLimitResult {
  const now = Date.now();
  const key = `${clientId}:${ip}`;
  const current = localGuestCounters.get(key) ?? { dayStartedAt: now, dayCount: 0 };
  if (now - current.dayStartedAt >= 86_400_000) {
    current.dayStartedAt = now;
    current.dayCount = 0;
  }
  const allowed = current.dayCount < TOOL_GUEST_DAILY_LIMIT;
  if (allowed) current.dayCount += 1;
  localGuestCounters.set(key, current);
  const dayReset = current.dayStartedAt + 86_400_000;
  return {
    allowed,
    retryAfterMs: allowed ? 0 : Math.max(0, dayReset - now),
    limit: TOOL_GUEST_DAILY_LIMIT,
    remaining: Math.max(0, TOOL_GUEST_DAILY_LIMIT - current.dayCount),
    reset: dayReset,
  };
}

function ensureLimiters() {
  if (!dailyLimiter) dailyLimiter = createLimiter(TOOL_GUEST_DAILY_LIMIT, "1 d", "rl:tools:guest:day");
}

export type GuestLimitResult = {
  allowed: boolean;
  retryAfterMs: number;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Enforce the free-tool limit for anonymous users — a single flat daily
 * budget (default 10) so the demo's countdown is never skewed by a hidden
 * per-minute cap:
 *  - daily cap per browser (client id): the visible budget that demo users
 *    see tick down
 *  - daily cap per IP address: the hard floor that survives storage resets,
 *    so clearing/rotating client ids can't extend a per-IP allowance
 */
export async function checkGuestToolLimit(clientId: string, ip: string): Promise<GuestLimitResult> {
  ensureLimiters();
  try {
    const [byClient, byIp] = await Promise.all([
      dailyLimiter!.limit(clientId),
      dailyLimiter!.limit(`ip:${ip}`),
    ]);
    const allowed = byClient.success && byIp.success;
    const retryAfterMs = allowed
      ? 0
      : Math.max(0, Math.max(byClient.reset, byIp.reset) - Date.now());
    return {
      allowed,
      retryAfterMs,
      limit: TOOL_GUEST_DAILY_LIMIT,
      remaining: Math.min(byClient.remaining, byIp.remaining),
      reset: Math.min(byClient.reset, byIp.reset),
    };
  } catch {
    // Preserve the public demo when Redis is down, while retaining a small
    // process-local guard until the distributed limiter recovers.
    return localGuestLimit(clientId, ip);
  }
}