import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";
import { createServiceClient } from "@/lib/supabase/server";

// ─── Plan Definitions ─────────────────────────────────────────────────

export type PlanId = "free" | "starter" | "pro" | "scale";
export type PaidPlanId = "starter" | "pro" | "scale";

export interface PlanLimits {
  monthlyScreenshots: number;
  apiKeys: number;
  rateLimitPerMinute: number;
  formats: string[];
  adBlocking: boolean;
  cookieBlocking: boolean;
  trackerBlocking: boolean;
  pdfExport: boolean;
  fullPage: boolean;
  elementCapture: boolean;
  /** Country-targeted rendering via the residential proxy gateway (Pro+). */
  geoTargeting: boolean;
  /** Video/GIF capture (format=mp4|gif|webm, Scale only). */
  videoCapture: boolean;
  /** Max seconds per video capture; 0 when videoCapture is false. */
  maxVideoSeconds: number;
  /** Days rendered screenshots are stored before automatic deletion. */
  retentionDays: number;
  /** Copy captures into the customer's S3/R2/GCS bucket (Pro+). */
  customerUpload: boolean;
}

const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyScreenshots: 100,
    apiKeys: 1,
    rateLimitPerMinute: 10,
    formats: ["png", "jpeg", "webp"],
    adBlocking: true,
    cookieBlocking: true,
    trackerBlocking: true,
    pdfExport: false,
    fullPage: false,
    elementCapture: true,
    geoTargeting: false,
    videoCapture: false,
    maxVideoSeconds: 0,
    retentionDays: 1,
    customerUpload: false,
  },
  starter: {
    monthlyScreenshots: 2500,
    apiKeys: 5,
    rateLimitPerMinute: 40,
    formats: ["png", "jpeg", "webp", "pdf"],
    adBlocking: true,
    cookieBlocking: true,
    trackerBlocking: true,
    pdfExport: true,
    fullPage: true,
    elementCapture: true,
    geoTargeting: false,
    videoCapture: false,
    maxVideoSeconds: 0,
    retentionDays: 30,
    customerUpload: false,
  },
  pro: {
    monthlyScreenshots: 15000,
    apiKeys: 25,
    rateLimitPerMinute: 120,
    formats: ["png", "jpeg", "webp", "pdf"],
    adBlocking: true,
    cookieBlocking: true,
    trackerBlocking: true,
    pdfExport: true,
    fullPage: true,
    elementCapture: true,
    geoTargeting: true,
    videoCapture: false,
    maxVideoSeconds: 0,
    retentionDays: 90,
    customerUpload: true,
  },
  scale: {
    monthlyScreenshots: 50000,
    apiKeys: 50,
    rateLimitPerMinute: 240,
    formats: ["png", "jpeg", "webp", "pdf", "gif", "mp4", "webm"],
    adBlocking: true,
    cookieBlocking: true,
    trackerBlocking: true,
    pdfExport: true,
    fullPage: true,
    elementCapture: true,
    geoTargeting: true,
    videoCapture: true,
    maxVideoSeconds: 30,
    retentionDays: 90,
    customerUpload: true,
  },
};

// ─── Upstash Rate Limiters (per-plan, lazy) ──────────────────────────

function createRateLimiter(maxRequests: number, prefix = "rl:ratelimit"): Ratelimit {
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
    prefix,
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

// ─── Job Queue Priority (Chapter 3 §12) ───────────────────────────────

/**
 * Queue priority derived from the customer's plan. Higher numbers are
 * processed first, so paid customers queue ahead of free traffic without
 * starving it entirely.
 */
export function getQueuePriority(plan: PlanId): number {
  switch (plan) {
    case "scale":
      return 30;
    case "pro":
      return 20;
    case "starter":
      return 10;
    default:
      return 0;
  }
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

// ─── Per-Key Rate Limiting (api_keys.rate_limit, requests/min) ────────

const keyRateLimiters = new Map<string, Ratelimit>();

/**
 * Enforce an individual key's rate_limit (requests per minute) on top of the
 * plan-level, user-wide limit. Returns null when the key has no custom limit
 * (0/null = plan default applies only), so callers can skip the extra check.
 */
export async function checkApiKeyRateLimit(
  apiKeyId: string,
  limitPerMinute: number | null | undefined
): Promise<{ allowed: boolean; retryAfterMs: number; limit: number; remaining: number; reset: number } | null> {
  if (!limitPerMinute || limitPerMinute <= 0) return null;
  const cacheKey = `${apiKeyId}:${limitPerMinute}`;
  let limiter = keyRateLimiters.get(cacheKey);
  if (!limiter) {
    limiter = createRateLimiter(limitPerMinute, "rl:keyratelimit");
    keyRateLimiters.set(cacheKey, limiter);
  }
  const result = await limiter.limit(`key:${apiKeyId}`);
  return {
    allowed: result.success,
    retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/** Days rendered screenshots are retained for a plan before automatic deletion. */
export function retentionDaysFor(plan: PlanId): number {
  return getPlanLimits(plan).retentionDays;
}

/** Distinct retention tiers across plans, ascending — drives the purge sweep. */
export const RETENTION_TIERS_DAYS: number[] = [
  ...new Set(Object.values(PLAN_LIMITS).map((l) => l.retentionDays)),
].sort((a, b) => a - b);

// ─── Format Validation ────────────────────────────────────────────────

export function isFormatAllowed(format: string, plan: PlanId): boolean {
  const limits = getPlanLimits(plan);
  return limits.formats.includes(format.toLowerCase());
}

// ─── Feature Checks ───────────────────────────────────────────────────

export function isPdfExportAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).pdfExport;
}

export function isFullPageAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).fullPage;
}

export function isGeoTargetingAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).geoTargeting;
}

export function isCustomerUploadAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).customerUpload;
}

export function isVideoCaptureAllowed(plan: PlanId): boolean {
  return getPlanLimits(plan).videoCapture;
}

export function maxVideoSecondsFor(plan: PlanId): number {
  return getPlanLimits(plan).maxVideoSeconds;
}

/**
 * Developer-facing entitlement snapshot for a plan, used to surface exactly
 * what a key is allowed to do (v1 /usage response) so callers can react
 * before hitting a 403 plan_feature error.
 */
export function getPlanEntitlements(plan: PlanId) {
  const limits = getPlanLimits(plan);
  return {
    plan,
    monthly_screenshots: limits.monthlyScreenshots,
    api_keys: limits.apiKeys,
    rate_limit_per_minute: limits.rateLimitPerMinute,
    formats: limits.formats,
    full_page: limits.fullPage,
    element_capture: limits.elementCapture,
    ad_blocking: limits.adBlocking,
    cookie_blocking: limits.cookieBlocking,
    tracker_blocking: limits.trackerBlocking,
    pdf_export: limits.pdfExport,
    geo_targeting: limits.geoTargeting,
    video_capture: limits.videoCapture,
    max_video_seconds: limits.maxVideoSeconds,
    retention_days: limits.retentionDays,
    customer_upload: limits.customerUpload,
  };
}

// ─── Shared render-feature gate ───────────────────────────────────────

export type PlanGateFeature = "format" | "pdf" | "full_page" | "geo" | "video";

export type PlanGateFailure = {
  message: string;
  required_plan: PaidPlanId;
  feature: PlanGateFeature;
};

export function planGateDetails(failure: PlanGateFailure) {
  return {
    required_plan: failure.required_plan,
    feature: failure.feature,
    upgrade_url: "/dashboard/plan",
  };
}

/**
 * Centralized plan-feature enforcement for screenshot render requests.
 * Applies the same checks across every render endpoint (/api/take,
 * /api/take/bulk, /api/v1/screenshots) so a feature gate can't be added to
 * one route and silently missed on another. Returns null when allowed, or
 * a failure reason when blocked. Does not cover ad/cookie blocking, which
 * are silently downgraded (not rejected) by the caller today.
 */
export function checkRenderFeatureGates(
  plan: PlanId,
  options: { format: string; full_page?: boolean; selector?: string; country?: string; video_seconds?: number }
): PlanGateFailure | null {
  if (!isFormatAllowed(options.format, plan)) {
    const required: PaidPlanId =
      options.format === "gif" || options.format === "mp4" || options.format === "webm" ? "scale" : "starter";
    return {
      message: `Format "${options.format}" requires the ${required === "scale" ? "Scale" : "Starter"} plan or above.`,
      required_plan: required,
      feature: "format",
    };
  }
  if (options.format === "pdf" && !isPdfExportAllowed(plan)) {
    return {
      message: "PDF export requires the Starter plan or above.",
      required_plan: "starter",
      feature: "pdf",
    };
  }
  if (options.full_page && !isFullPageAllowed(plan)) {
    return {
      message: "Full-page captures require the Starter plan or above.",
      required_plan: "starter",
      feature: "full_page",
    };
  }
  if (options.country && !isGeoTargetingAllowed(plan)) {
    return {
      message: "Geo-targeted rendering requires the Pro plan or above.",
      required_plan: "pro",
      feature: "geo",
    };
  }
  if (options.video_seconds && options.video_seconds > 0) {
    if (!isVideoCaptureAllowed(plan)) {
      return {
        message: "Video capture requires the Scale plan.",
        required_plan: "scale",
        feature: "video",
      };
    }
    const maxSeconds = maxVideoSecondsFor(plan);
    if (options.video_seconds > maxSeconds) {
      return {
        message: `Video captures are limited to ${maxSeconds} seconds on your plan.`,
        required_plan: "scale",
        feature: "video",
      };
    }
  }
  return null;
}

// ─── Plan Comparison (for dashboard) ──────────────────────────────────

export function getAllPlanLimits(): { id: PlanId; limits: PlanLimits }[] {
  return Object.entries(PLAN_LIMITS).map(([id, limits]) => ({ id: id as PlanId, limits }));
}

// ─── Dodo product → plan resolution (billing) ─────────────────────────
//
// Single source of truth for mapping a Dodo product id to one of our paid
// plans. Previously duplicated (with slightly different fallback coverage)
// across src/app/api/checkout/route.ts, src/app/api/webhooks/dodo/route.ts,
// and src/app/actions/billing.ts.

/** Monthly USD price per paid plan; used for checkout proration decisions. */
export const PLAN_PRICES: Record<PaidPlanId, number> = { starter: 9, pro: 49, scale: 79 };

export type ResolvedPlan = { plan: PaidPlanId; monthlyLimit: number; price: number };

export function planInfoFor(plan: PaidPlanId): ResolvedPlan {
  return {
    plan,
    monthlyLimit: getPlanLimits(plan).monthlyScreenshots,
    price: PLAN_PRICES[plan],
  };
}

/**
 * Product IDs are stored twice in env (`NEXT_PUBLIC_DODO_PRODUCT_*` for the
 * client, `DODO_PRODUCT_*` for scripts). Accept either so checkout/webhooks
 * still resolve if only one side is filled in.
 */
export function dodoProductEnvId(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function dodoPlanProductMappings(): [string | undefined, PaidPlanId][] {
  return [
    [dodoProductEnvId("NEXT_PUBLIC_DODO_PRODUCT_STARTER_ID", "DODO_PRODUCT_STARTER_ID"), "starter"],
    [dodoProductEnvId("NEXT_PUBLIC_DODO_PRODUCT_PRO_ID", "DODO_PRODUCT_PRO_ID"), "pro"],
    [dodoProductEnvId("NEXT_PUBLIC_DODO_PRODUCT_SCALE_ID", "DODO_PRODUCT_SCALE_ID"), "scale"],
    [dodoProductEnvId("NEXT_PUBLIC_DODO_PRODUCT_STARTER_ANNUAL_ID", "DODO_PRODUCT_STARTER_ANNUAL_ID"), "starter"],
    [dodoProductEnvId("NEXT_PUBLIC_DODO_PRODUCT_PRO_ANNUAL_ID", "DODO_PRODUCT_PRO_ANNUAL_ID"), "pro"],
    [dodoProductEnvId("NEXT_PUBLIC_DODO_PRODUCT_SCALE_ANNUAL_ID", "DODO_PRODUCT_SCALE_ANNUAL_ID"), "scale"],
  ];
}

/**
 * Resolve a Dodo product id to one of our plans:
 *  1. Env-configured product IDs (monthly + annual variants) — fast path.
 *  2. `metadata.plan` on the Dodo product itself (survives product
 *     recreation, since Dodo product IDs are opaque and may change).
 *  3. Product id substring match ("scale"/"pro"/"starter") — last resort.
 *
 * `fetchProductMetadata` is injected so this module doesn't need to depend
 * on the Dodo SDK; callers pass e.g. `(id) => client.products.retrieve(id)`.
 */
export async function resolvePlanFromDodoProduct(
  productId: string | undefined,
  fetchProductMetadata?: (productId: string) => Promise<{ metadata?: Record<string, unknown> } | null>
): Promise<ResolvedPlan | null> {
  if (!productId) return null;

  const mappings = dodoPlanProductMappings();
  for (const [pid, plan] of mappings) {
    if (pid && pid === productId) return planInfoFor(plan);
  }

  if (fetchProductMetadata) {
    try {
      const product = await fetchProductMetadata(productId);
      const metaPlan = product?.metadata?.plan;
      if (metaPlan === "starter" || metaPlan === "pro" || metaPlan === "scale") {
        return planInfoFor(metaPlan);
      }
    } catch {
      // fall through to substring match
    }
  }

  // Substring match is ordered longest-first so e.g. a "scale" product id
  // containing "pro" as a substring still resolves to scale.
  const lower = productId.toLowerCase();
  if (lower.includes("scale")) return planInfoFor("scale");
  if (lower.includes("pro")) return planInfoFor("pro");
  if (lower.includes("starter")) return planInfoFor("starter");

  return null;
}
