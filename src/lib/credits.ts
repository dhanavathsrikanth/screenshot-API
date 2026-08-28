import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/redis";

type CreditState = {
  user_id: string;
  plan: "free" | "starter" | "pro" | string;
  credit_balance: number;
  top_up_balance: number;
  overage_enabled: boolean;
};

type EnsureResult =
  | { allowed: true; mode: "deducted" | "overage"; units: number; localDeducted: number }
  | { allowed: false; mode: "blocked"; reason: string };

const CACHE_TTL_SECONDS = 10;

/** Formats that produce an animated capture (Phase 2: video pipeline). */
export const VIDEO_FORMATS = new Set(["mp4", "webm", "gif"]);

function creditsCacheKey(userId: string) {
  return `cache:credits:${userId}`;
}

async function loadState(userId: string): Promise<CreditState | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("user_quotas")
    .select("user_id, plan, credit_balance, top_up_balance, overage_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    user_id: userId,
    plan: (data.plan ?? "free") as CreditState["plan"],
    credit_balance: data.credit_balance ?? 0,
    top_up_balance: data.top_up_balance ?? 0,
    overage_enabled: data.overage_enabled ?? false,
  };
}

export async function getCreditState(userId: string): Promise<CreditState | null> {
  const cached = await cacheGet<CreditState>(creditsCacheKey(userId));
  if (cached) return cached;

  const state = await loadState(userId);
  if (state) {
    await cacheSet(creditsCacheKey(userId), state, CACHE_TTL_SECONDS);
  }
  return state;
}

function envOrDefault(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

async function sendUsageEvent(customerId: string, units: number, kind: "screenshot" | "pdf", metadata: Record<string, unknown> = {}) {
  const dodoConfig = getDodoConfig();
  const client = new DodoPayments({
    bearerToken: dodoConfig.apiKey,
    environment: dodoConfig.environment as "test_mode" | "live_mode",
  });

  const eventName =
    kind === "pdf"
      ? envOrDefault("DODO_USAGE_EVENT_NAME_PDF", "screentool.pdf_pages")
      : envOrDefault("DODO_USAGE_EVENT_NAME_SCREENSHOT", "screentool.screenshot");

  const safeMetadata: Record<string, string | number | boolean> = {
    units,
    kind,
  };
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safeMetadata[key] = value;
    }
  }

  const event = {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    customer_id: customerId,
    event_name: eventName,
    timestamp: new Date().toISOString(),
    metadata: safeMetadata,
  };

  await client.usageEvents.ingest({ events: [event] });
}

async function getDodoCustomerId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("users")
    .select("dodo_customer_id")
    .eq("id", userId)
    .maybeSingle();

  return data?.dodo_customer_id ?? null;
}

/**
 * Meter usage to Dodo so its credit-billed meter auto-deducts credits.
 * Best-effort: a metering failure must never block a paying customer, and
 * users without a Dodo customer mapping (e.g. Free plan) are skipped.
 * Dodo's balance is the source of truth; the local counter is a fast mirror
 * that webhook syncs correct.
 */
export async function meterUsageToDodo(
  userId: string,
  units: number,
  kind: "screenshot" | "pdf",
  metadata: Record<string, unknown> = {}
): Promise<void> {
  if (units <= 0) return;
  const customerId = await getDodoCustomerId(userId);
  if (!customerId) return;
  try {
    await sendUsageEvent(customerId, units, kind, metadata);
  } catch {
    // best-effort
  }
}

/**
 * Credits required for a request.
 * Every served request is charged (cache hits included — product decision):
 *  - single image screenshot => 1 unit
 *  - bulk => 1 unit per URL (and per page for PDFs)
 *  - pdf => 5 units per page (defaults to 5 when page count is unknown)
 *  - video (mp4/gif/webm) => max(5, duration in seconds) units per URL
 *  - geo-targeted renders => x2 multiplier (residential proxy cost)
 */
export function computeUnits(params: {
  cached: boolean;
  format: string;
  bulkCount?: number;
  pdfPages?: number;
  videoSeconds?: number;
  geoTargeted?: boolean;
}): { units: number; kind: "screenshot" | "pdf" } {
  const count = Math.max(1, params.bulkCount ?? 1);
  let perItem: number;
  if (params.format === "pdf") {
    const pages = Math.max(1, params.pdfPages ?? 1);
    return { units: count * pages * 5, kind: "pdf" };
  }
  if (VIDEO_FORMATS.has(params.format.toLowerCase())) {
    // Animated capture is billed by recording time; floor of 5 covers encode overhead.
    perItem = Math.max(5, Math.ceil(params.videoSeconds ?? 0));
  } else {
    perItem = 1;
  }
  if (params.geoTargeted) perItem *= 2;
  return { units: count * perItem, kind: "screenshot" };
}

/**
 * Atomically check-and-deduct credits via the try_deduct_credits RPC.
 * Fails closed: returns false when the balance can't cover the amount.
 */
async function deductCredits(userId: string, amount: number): Promise<boolean> {
  if (amount <= 0) return true;
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("try_deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) {
    console.error("[credits] try_deduct_credits failed:", error.message);
    return false;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) return false;
  await cacheInvalidate(creditsCacheKey(userId));
  return true;
}

/**
 * Refund credits that were charged upfront but not actually rendered
 * (e.g. URLs that failed inside a bulk request).
 */
export async function refundCredits(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const supabase = createServiceClient();
  const { error } = await supabase.rpc("refund_credits", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) {
    console.error("[credits] refund_credits failed:", error.message);
    return;
  }
  await cacheInvalidate(creditsCacheKey(userId));
}

/**
 * Ensure credits are available; deduct from monthly credit_balance first, then top_up_balance.
 * For paid plans with a Dodo customer mapping, EVERY served request is also
 * metered to Dodo (when `meter` is not disabled) so its credit-billed meter
 * auto-deducts — local is only a fast mirror of the authoritative Dodo balance.
 * If still insufficient and overage is enabled (non-free plan), allow and meter usage to Dodo.
 * Returns:
 *  - allowed true, mode "deducted" when credits were deducted locally
 *  - allowed true, mode "overage" when allowed via overage; event sent to Dodo if customer mapping exists
 *  - allowed false when blocked (e.g., Free plan out of credits)
 */
export async function ensureCredits(userId: string, params: {
  cached: boolean;
  format: string;
  bulkCount?: number;
  pdfPages?: number;
  videoSeconds?: number;
  geoTargeted?: boolean;
  meterMetadata?: Record<string, unknown>;
  /** Disable Dodo metering so the caller meters successes individually (bulk). Defaults to true. */
  meter?: boolean;
}): Promise<EnsureResult> {
  let state = await getCreditState(userId);
  if (!state) {
    // Seed welcome credits for new/legacy users (e.g. first API call before ever visiting the dashboard)
    await ensureWelcomeCredits(userId);
    state = await loadState(userId);
    if (!state) {
      return { allowed: false, mode: "blocked", reason: "no_quota_row" };
    }
  }

  const { units, kind } = computeUnits(params);
  if (units === 0) {
    return { allowed: true, mode: "deducted", units: 0, localDeducted: 0 };
  }

  const isPaidPlan = state.plan !== "free";
  const shouldMeter = params.meter !== false && isPaidPlan;

  // Estimate local coverage (used for the overage decision; actual deduction is atomic)
  let remaining = units;
  const fromMonthly = Math.min(state.credit_balance, remaining);
  remaining -= fromMonthly;
  if (remaining > 0) {
    const fromTopup = Math.min(state.top_up_balance, remaining);
    remaining -= fromTopup;
  }
  const covered = units - remaining;

  if (remaining <= 0) {
    const ok = await deductCredits(userId, units);
    if (!ok) return { allowed: false, mode: "blocked", reason: "no_credits" };
    if (shouldMeter) await meterUsageToDodo(userId, units, kind, params.meterMetadata ?? {});
    return { allowed: true, mode: "deducted", units, localDeducted: units };
  }

  // Not enough local credits
  if (isPaidPlan && state.overage_enabled) {
    // Meter the full request to Dodo — its entitlement handles balance vs overage pricing
    if (shouldMeter) await meterUsageToDodo(userId, units, kind, params.meterMetadata ?? {});
    // Deduct whatever local balance could cover so the mirrors stay accurate
    if (covered > 0) {
      const ok = await deductCredits(userId, covered);
      if (!ok) return { allowed: false, mode: "blocked", reason: "no_credits" };
    }
    return { allowed: true, mode: "overage", units, localDeducted: covered };
  }

  // Block for Free plan or when overage disabled
  return { allowed: false, mode: "blocked", reason: "no_credits" };
}

// One-time 100 free credits grant for new or previously signed-in users without credits
export async function ensureWelcomeCredits(userId: string): Promise<void> {
  const supabase = createServiceClient();

  // Check existing quota row and credit state
  const { data, error } = await supabase
    .from("user_quotas")
    .select("user_id, plan, credit_balance, credits_granted_this_cycle")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Avoid throwing during page load; rely on DB trigger/webhook seeding
    return;
  }

  const BASE = 100;

  // If no quota row exists (older accounts before trigger), create one with 100 credits
  if (!data) {
    await supabase
      .from("user_quotas")
      .insert({
        user_id: userId,
        plan: "free",
        monthly_limit: BASE,
        monthly_used: 0,
        credit_balance: BASE,
        credits_used_this_cycle: 0,
        credits_granted_this_cycle: BASE,
        top_up_balance: 0,
        overage_enabled: false,
      })
      .then(async () => {
        await cacheInvalidate(creditsCacheKey(userId));
      });
    return;
  }

  // If a row exists but this user never received free credits (both zero), grant once
  const plan = (data.plan ?? "free") as string;
  const currentBalance = data.credit_balance ?? 0;
  const grantedThisCycle = data.credits_granted_this_cycle ?? 0;

  if (plan === "free" && currentBalance === 0 && grantedThisCycle === 0) {
    await supabase
      .from("user_quotas")
      .update({
        credit_balance: BASE,
        credits_granted_this_cycle: BASE,
        credits_used_this_cycle: 0,
      })
      .eq("user_id", userId);

    await cacheInvalidate(creditsCacheKey(userId));
  }
}
