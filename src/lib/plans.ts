import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";
import { createServiceClient } from "@/lib/supabase/server";

// ─── Plan Definitions ─────────────────────────────────────────────────

export type PlanId = "free" | "starter" | "pro" | "business";

export interface PlanLimits {
  monthlyScreenshots: number;
  apiKeys: number;
  rateLimitPerMinute: number;
  formats: string[];
  adBlocking: boolean;
  cookieBlocking: boolean;
  cloudStorage: boolean;
  pdfExport: boolean;
}

const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyScreenshots: 100,
    apiKeys: 1,
    rateLimitPerMinute: 10,
    formats: ["png", "jpeg", "webp"],
    adBlocking: false,
    cookieBlocking: false,
    cloudStorage: false,
    pdfExport: false,
  },
  starter: {
    monthlyScreenshots: 2500,
    apiKeys: 5,
    rateLimitPerMinute: 40,
    formats: ["png", "jpeg", "webp", "pdf"],
    adBlocking: true,
    cookieBlocking: true,
    cloudStorage: false,
    pdfExport: true,
  },
  pro: {
    monthlyScreenshots: 15000,
    apiKeys: 25,
    rateLimitPerMinute: 120,
    formats: ["png", "jpeg", "webp", "pdf"],
    adBlocking: true,
    cookieBlocking: true,
    cloudStorage: true,
    pdfExport: true,
  },
  business: {
    monthlyScreenshots: 50000,
    apiKeys: 100,
    rateLimitPerMinute: 500,
    formats: ["png", "jpeg", "webp", "pdf"],
    adBlocking: true,
    cookieBlocking: true,
    cloudStorage: true,
    pdfExport: true,
  },
};

// ─── Upstash Rate Limiters (per-plan, lazy) ──────────────────────────

function createRateLimiter(maxRequests: number): Ratelimit {
  const client = getRedis();
  if (!client) {
    // Return a no-op ratelimit that always allows requests when Redis is unavailable
    return {
      limit: async () => ({ success: true, limit: maxRequests, remaining: maxRequests, reset: Date.now() + 60000 }),
    } as unknown as Ratelimit;
  }
  return new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(maxRequests, "60 s"),
    analytics: true,
    prefix: "rl:ratelimit",
  });
}

const rateLimiters = new Map<PlanId, Ratelimit>();
let rateLimitersInitialized = false;

function ensureRateLimiters() {
  if (rateLimitersInitialized) return;
  for (const [plan, limits] of Object.entries(PLAN_LIMITS)) {
    rateLimiters.set(plan as PlanId, createRateLimiter(limits.rateLimitPerMinute));
  }
  rateLimitersInitialized = true;
}

// ─── Get User Plan (cached 60s) ───────────────────────────────────────

export async function getUserPlan(userId: string): Promise<PlanId> {
  try {
    const { cacheGet, cacheSet } = await import("@/lib/redis");
    const cached = await cacheGet<PlanId>(`cache:userplan:${userId}`);
    if (cached) return cached;

    const supabase = createServiceClient();
    const { data } = await supabase
      .from("user_quotas")
      .select("plan")
      .eq("user_id", userId)
      .single();

    const plan = (data?.plan ?? "free") as PlanId;
    const valid = plan in PLAN_LIMITS ? plan : "free";
    await cacheSet(`cache:userplan:${userId}`, valid, 60);
    return valid;
  } catch {
    return "free";
  }
}

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

// ─── Quota Enforcement ────────────────────────────────────────────────

export async function checkQuota(userId: string): Promise<{ allowed: boolean; used: number; limit: number; plan: PlanId }> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("user_quotas")
    .select("monthly_used, monthly_limit")
    .eq("user_id", userId)
    .single();

  const used = data?.monthly_used ?? 0;
  const limit = data?.monthly_limit ?? limits.monthlyScreenshots;

  return { allowed: used < limit, used, limit, plan };
}

// ─── API Key Limit ────────────────────────────────────────────────────

export async function checkApiKeyLimit(userId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const current = count ?? 0;
  return { allowed: current < limits.apiKeys, current, limit: limits.apiKeys };
}

// ─── Rate Limiting (Upstash distributed sliding window) ───────────────

export async function checkRateLimit(
  userId: string,
  plan: PlanId
): Promise<{ allowed: boolean; retryAfterMs: number; limit: number; remaining: number; reset: number }> {
  ensureRateLimiters();
  const limiter = rateLimiters.get(plan) ?? rateLimiters.get("free")!;
  const result = await limiter.limit(userId);

  return {
    allowed: result.success,
    retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// ─── Format Validation ────────────────────────────────────────────────

export function isFormatAllowed(format: string, plan: PlanId): boolean {
  const limits = getPlanLimits(plan);
  return limits.formats.includes(format.toLowerCase());
}

// ─── Feature Checks ───────────────────────────────────────────────────

export function isAdBlockingAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).adBlocking;
}

export function isCookieBlockingAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).cookieBlocking;
}

export function isCloudStorageAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).cloudStorage;
}

export function isPdfExportAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).pdfExport;
}

// ─── Plan Comparison (for dashboard) ──────────────────────────────────

export function getAllPlanLimits(): { id: PlanId; limits: PlanLimits }[] {
  return Object.entries(PLAN_LIMITS).map(([id, limits]) => ({ id: id as PlanId, limits }));
}
