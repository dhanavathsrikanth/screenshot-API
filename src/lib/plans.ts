import { createServiceClient } from "@/lib/supabase/server";

const supabase = createServiceClient();

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

// ─── Get User Plan ────────────────────────────────────────────────────

export async function getUserPlan(userId: string): Promise<PlanId> {
  const { data } = await supabase
    .from("user_quotas")
    .select("plan")
    .eq("user_id", userId)
    .single();

  const plan = (data?.plan ?? "free") as PlanId;
  return plan in PLAN_LIMITS ? plan : "free";
}

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

// ─── Quota Enforcement ────────────────────────────────────────────────

export async function checkQuota(userId: string): Promise<{ allowed: boolean; used: number; limit: number; plan: PlanId }> {
  const plan = await getUserPlan(userId);
  const limits = getPlanLimits(plan);

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

  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const current = count ?? 0;
  return { allowed: current < limits.apiKeys, current, limit: limits.apiKeys };
}

// ─── Rate Limiting (in-memory, per-user sliding window) ───────────────

const rateLimitStore = new Map<string, number[]>();

export function checkRateLimit(userId: string, plan: PlanId): { allowed: boolean; retryAfterMs: number } {
  const limits = getPlanLimits(plan);
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = limits.rateLimitPerMinute;

  const timestamps = rateLimitStore.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    const oldest = recent[0];
    const retryAfterMs = windowMs - (now - oldest);
    return { allowed: false, retryAfterMs };
  }

  recent.push(now);
  rateLimitStore.set(userId, recent);

  return { allowed: true, retryAfterMs: 0 };
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
