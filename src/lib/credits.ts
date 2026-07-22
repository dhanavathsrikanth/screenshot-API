import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/redis";
import { getPlanLimits, type PlanId } from "@/lib/plans";

type CreditState = {
  user_id: string;
  plan: "free" | "starter" | "pro" | "business" | string;
  credit_balance: number;
  top_up_balance: number;
  overage_enabled: boolean;
};

type EnsureResult =
  | { allowed: true; mode: "deducted" | "overage"; units: number }
  | { allowed: false; mode: "blocked"; reason: string };

const CACHE_TTL_SECONDS = 10;

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
    plan: (data.plan as any) ?? "free",
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

async function updateState(
  userId: string,
  update: Partial<Pick<CreditState, "credit_balance" | "top_up_balance">> & {
    used_increment?: number;
  }
): Promise<void> {
  const supabase = createServiceClient();

  // Prefer atomic RPC for usage deductions to avoid race conditions
  if (typeof update.used_increment === "number" && update.used_increment > 0) {
    const delta = -Math.abs(update.used_increment);
    await supabase.rpc("adjust_credits", { p_user_id: userId, p_delta: delta });
    await cacheInvalidate(creditsCacheKey(userId));
    return;
  }

  // Otherwise, apply absolute balance updates (e.g., sync or top-ups)
  const patch: Record<string, unknown> = {};
  if (typeof update.credit_balance === "number") patch.credit_balance = update.credit_balance;
  if (typeof update.top_up_balance === "number") patch.top_up_balance = update.top_up_balance;

  if (Object.keys(patch).length > 0) {
    await supabase.from("user_quotas").update(patch).eq("user_id", userId);
    await cacheInvalidate(creditsCacheKey(userId));
  }
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

  const event = {
    event_id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    customer_id: customerId,
    event_name: eventName,
    timestamp: new Date().toISOString(),
    metadata: {
      units,
      kind,
      ...metadata,
    } as Record<string, unknown>,
  };

  await client.usageEvents.ingest({ events: [event] as any });
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
 * Determine required units for a request
 * - cached screenshot => 0 units
 * - image screenshot => 1 unit
 * - bulk => N units
 * - pdf => 5 units per page (defaults to 5 if page count unknown)
 */
export function computeUnits(params: {
  cached: boolean;
  format: string;
  bulkCount?: number;
  pdfPages?: number;
}): { units: number; kind: "screenshot" | "pdf" } {
  if (params.cached) return { units: 0, kind: "screenshot" };
  if (params.format === "pdf") {
    const pages = Math.max(1, params.pdfPages ?? 1);
    return { units: pages * 5, kind: "pdf" };
  }
  const count = Math.max(1, params.bulkCount ?? 1);
  return { units: count, kind: "screenshot" };
}

/**
 * Ensure credits are available; deduct from monthly credit_balance first, then top_up_balance.
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
  meterMetadata?: Record<string, unknown>;
}): Promise<EnsureResult> {
  const state = await getCreditState(userId);
  if (!state) {
    // Initialize a row on first use if missing
    return { allowed: false, mode: "blocked", reason: "no_quota_row" };
  }

  // Auto-initialize credits from plan limit if never granted
  // Only auto-seed when a paid plan has just been initialized (never for free plan).
  if (state.credit_balance === 0 && state.top_up_balance === 0 && state.plan !== "free") {
    const plan = (state.plan || "free") as PlanId;
    const limits = getPlanLimits(plan);
    const initialCredits = limits.monthlyScreenshots;

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("user_quotas")
      .update({
        credit_balance: initialCredits,
        credits_granted_this_cycle: initialCredits,
        credits_used_this_cycle: 0,
      })
      .eq("user_id", userId)
      .eq("credits_granted_this_cycle", 0);

    if (!error) {
      await cacheInvalidate(creditsCacheKey(userId));
    }
  }

  const { units, kind } = computeUnits(params);
  if (units === 0) {
    return { allowed: true, mode: "deducted", units: 0 };
  }

  // Perform local deduction logic
  let remaining = units;
  let nextMonthly = state.credit_balance;
  let nextTopup = state.top_up_balance;

  const fromMonthly = Math.min(nextMonthly, remaining);
  nextMonthly -= fromMonthly;
  remaining -= fromMonthly;

  if (remaining > 0) {
    const fromTopup = Math.min(nextTopup, remaining);
    nextTopup -= fromTopup;
    remaining -= fromTopup;
  }

  if (remaining <= 0) {
    // All covered locally
    await updateState(userId, {
      credit_balance: nextMonthly,
      top_up_balance: nextTopup,
      used_increment: units,
    });
    return { allowed: true, mode: "deducted", units };
  }

  // Not enough local credits
  const isPaidPlan = state.plan !== "free";
  if (isPaidPlan && state.overage_enabled) {
    // Allow overage; meter to Dodo
    const customerId = await getDodoCustomerId(userId);
    if (customerId) {
      try {
        await sendUsageEvent(customerId, units, kind, params.meterMetadata ?? {});
      } catch {
        // If metering fails, still allow the request, but log in your observability (omitted here)
      }
    }
    // Keep local balances at the fully deducted levels (zeroed if needed)
    await updateState(userId, {
      credit_balance: nextMonthly,
      top_up_balance: nextTopup,
      used_increment: units - remaining, // only what we could cover locally is counted as "used"
    });
    return { allowed: true, mode: "overage", units };
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
  const plan = (data.plan as any) ?? "free";
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
