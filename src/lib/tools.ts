import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";
import { TOOL_GUEST_PER_MINUTE, TOOL_GUEST_DAILY_LIMIT } from "@/lib/tool-limits";

function createLimiter(maxRequests: number, window: Duration, prefix: string): Ratelimit {
  const client = getRedis();
  if (!client) {
    // No-op limiter when Redis is unavailable — never blocks the free tool
    return {
      limit: async () => ({ success: true, limit: maxRequests, remaining: maxRequests, reset: Date.now() + 60000 }),
    } as unknown as Ratelimit;
  }
  return new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(maxRequests, window),
    analytics: true,
    prefix,
  });
}

let minuteLimiter: Ratelimit | null = null;
let dailyLimiter: Ratelimit | null = null;

function ensureLimiters() {
  if (!minuteLimiter) minuteLimiter = createLimiter(TOOL_GUEST_PER_MINUTE, "60 s", "rl:tools:guest:min");
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
 * Enforce free-tool limits for anonymous users:
 *  - burst cap per browser (client id)
 *  - burst cap per IP address (so a spoofed/rotated client id can't bypass
 *    the browser-level burst cap entirely)
 *  - daily cap per IP address (so clearing storage can't reset it)
 */
export async function checkGuestToolLimit(clientId: string, ip: string): Promise<GuestLimitResult> {
  ensureLimiters();
  const [burstByClient, burstByIp, daily] = await Promise.all([
    minuteLimiter!.limit(clientId),
    minuteLimiter!.limit(`ip:${ip}`),
    dailyLimiter!.limit(`ip:${ip}`),
  ]);
  const allowed = burstByClient.success && burstByIp.success && daily.success;
  const retryAfterMs = allowed
    ? 0
    : Math.max(0, Math.max(burstByClient.reset, burstByIp.reset, daily.reset) - Date.now());
  return {
    allowed,
    retryAfterMs,
    limit: daily.limit,
    remaining: Math.min(burstByClient.remaining, burstByIp.remaining, daily.remaining),
    reset: Math.min(burstByClient.reset, burstByIp.reset, daily.reset),
  };
}
