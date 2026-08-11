import { createServiceClient } from "@/lib/supabase/server";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { cacheInvalidate } from "@/lib/redis";
import type { SubscriptionListParams, SubscriptionListResponse } from "dodopayments/resources/subscriptions";

type PlanId = "starter" | "pro" | "business";
type PlanInfo = { plan: PlanId; monthlyLimit: number };

function planInfoFor(plan: PlanId): PlanInfo {
  return plan === "business"
    ? { plan: "business", monthlyLimit: 50000 }
    : plan === "pro"
      ? { plan: "pro", monthlyLimit: 15000 }
      : { plan: "starter", monthlyLimit: 2500 };
}

function toCredits(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function getDodoClient() {
  const dodoConfig = getDodoConfig();
  return new DodoPayments({
    bearerToken: dodoConfig.apiKey,
    environment: dodoConfig.environment as "test_mode" | "live_mode",
  });
}

// Mirrors resolvePlanFromProduct() in src/app/api/webhooks/dodo/route.ts.
async function resolvePlanFromProduct(productId: string | undefined, client: DodoPayments): Promise<PlanInfo | null> {
  if (!productId) return null;

  const mappings: [string, PlanId][] = [
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER_ID ?? "", "starter"],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO_ID ?? "", "pro"],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_BUSINESS_ID ?? "", "business"],
  ];

  for (const [pid, plan] of mappings) {
    if (pid && pid === productId) return planInfoFor(plan);
  }

  try {
    const product = (await client.products.retrieve(productId)) as { metadata?: Record<string, unknown> };
    const metaPlan = product?.metadata?.plan;
    if (metaPlan === "starter" || metaPlan === "pro" || metaPlan === "business") {
      return planInfoFor(metaPlan);
    }
  } catch (err) {
    console.error(`[billing] Failed to fetch product ${productId}:`, (err as Error)?.message ?? err);
  }

  const lower = productId.toLowerCase();
  if (lower.includes("business")) return planInfoFor("business");
  if (lower.includes("pro")) return planInfoFor("pro");
  if (lower.includes("starter")) return planInfoFor("starter");

  return null;
}

const ACTIVE_STATUSES = ["active", "on_hold", "pending"] as const;

async function listUserSubscriptions(
  client: DodoPayments,
  customerId: string | null,
  productId?: string
): Promise<SubscriptionListResponse[]> {
  const subs: SubscriptionListResponse[] = [];
  const seen = new Set<string>();

  for (const status of ACTIVE_STATUSES) {
    const params: SubscriptionListParams = { status, page_size: 100 };
    if (customerId) params.customer_id = customerId;
    if (productId) params.product_id = productId;

    try {
      for await (const sub of client.subscriptions.list(params)) {
        if (sub?.subscription_id && !seen.has(sub.subscription_id)) {
          seen.add(sub.subscription_id);
          subs.push(sub);
        }
      }
    } catch (err) {
      console.error(`[billing] List ${status} subscriptions failed:`, (err as Error)?.message ?? err);
    }
  }

  return subs;
}

async function fetchAuthoritativeBalance(
  client: DodoPayments,
  customerId: string | null
): Promise<number | null> {
  const creditEntitlementId = process.env.DODO_CREDIT_ENTITLEMENT_ID;
  if (!customerId || !creditEntitlementId) return null;

  try {
    const balance = (await client.creditEntitlements.balances.retrieve(customerId, {
      credit_entitlement_id: creditEntitlementId,
    })) as { balance?: unknown };
    return toCredits(balance?.balance);
  } catch (err) {
    console.error(`[billing] Failed to fetch Dodo balance for ${customerId}:`, (err as Error)?.message ?? err);
    return null;
  }
}

export type ReconcileResult = {
  plan: string | null;
  applied: boolean;
  reason?: string;
};

/**
 * Backstop for a missed/failed Dodo webhook after checkout. Called from the
 * plan page when the user returns from a successful checkout (?upgraded=1).
 * Resolves the authoritative plan from the user's active Dodo subscription
 * (env map → product metadata → name → pending plan from checkout) and aligns
 * user_quotas, then clears the pending markers. Idempotent.
 */
export async function reconcilePlanAfterCheckout(userId: string): Promise<ReconcileResult> {
  const supabase = createServiceClient();
  const client = getDodoClient();

  const { data: userRow } = await supabase
    .from("users")
    .select("dodo_customer_id")
    .eq("id", userId)
    .maybeSingle();
  const customerId = userRow?.dodo_customer_id ?? null;

  const { data: quota } = await supabase
    .from("user_quotas")
    .select(
      "plan, pending_plan, pending_product_id, dodo_subscription_id, dodo_product_id, monthly_limit, overage_enabled, credit_balance, top_up_balance"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const pendingPlan = quota?.pending_plan;
  const pendingProductId = quota?.pending_product_id;

  // Nothing to reconcile: no pending upgrade and no customer to query against.
  if (!pendingProductId && !customerId) {
    return { plan: quota?.plan ?? null, applied: false, reason: "no pending plan or customer" };
  }

  // Prefer subscriptions for the pending product, then all non-cancelled ones.
  let subs = pendingProductId ? await listUserSubscriptions(client, customerId, pendingProductId) : [];
  if (subs.length === 0 && customerId) {
    subs = await listUserSubscriptions(client, customerId);
  }

  // Pick the best subscription: active over on_hold/pending, then newest.
  subs.sort((a, b) => {
    const rankA = ACTIVE_STATUSES.indexOf(a?.status as (typeof ACTIVE_STATUSES)[number]);
    const rankB = ACTIVE_STATUSES.indexOf(b?.status as (typeof ACTIVE_STATUSES)[number]);
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b?.created_at ?? 0).getTime() - new Date(a?.created_at ?? 0).getTime();
  });

  const sub = subs[0];
  if (!sub) {
    return { plan: quota?.plan ?? null, applied: false, reason: "no active subscription" };
  }

  const productId: string = sub?.product_id ?? pendingProductId ?? null;
  let planInfo = await resolvePlanFromProduct(productId, client);

  // Pending-plan fallback for opaque/recreated product IDs.
  if (
    !planInfo &&
    pendingProductId &&
    productId === pendingProductId &&
    (pendingPlan === "starter" || pendingPlan === "pro" || pendingPlan === "business")
  ) {
    planInfo = planInfoFor(pendingPlan);
  }

  if (!planInfo) {
    return { plan: quota?.plan ?? null, applied: false, reason: `no plan mapping for product ${productId}` };
  }

  const changes: Record<string, unknown> = {
    plan: planInfo.plan,
    monthly_limit: planInfo.monthlyLimit,
    overage_enabled: true,
    dodo_subscription_id: sub?.subscription_id ?? null,
    dodo_product_id: productId,
    pending_plan: null,
    pending_product_id: null,
  };

  // Preserve leftover free credits as top-up when moving free → paid (mirrors
  // upgradePlan() in the webhook).
  const creditBalance = await fetchAuthoritativeBalance(
    client,
    sub?.customer?.customer_id ?? customerId
  );

  if (quota?.plan === "free") {
    const freeRemainder = Math.max(0, Number(quota.credit_balance ?? 0));
    if (freeRemainder > 0) {
      changes.top_up_balance = Math.max(0, Number(quota.top_up_balance ?? 0)) + freeRemainder;
      changes.credit_balance = creditBalance ?? 0;
    } else if (creditBalance !== null) {
      changes.credit_balance = creditBalance;
    }
  } else if (creditBalance !== null) {
    changes.credit_balance = creditBalance;
  }

  const { error } = await supabase
    .from("user_quotas")
    .upsert({ user_id: userId, ...changes }, { onConflict: "user_id" });

  if (error) {
    console.error("[billing] Reconcile failed:", error.message);
    return { plan: quota?.plan ?? null, applied: false, reason: error.message };
  }

  await Promise.allSettled([
    cacheInvalidate(`cache:userplan:${userId}`),
    cacheInvalidate(`cache:credits:${userId}`),
  ]);

  console.log(`[billing] Reconciled user ${userId} to ${planInfo.plan} (subscription ${sub?.subscription_id})`);
  return { plan: planInfo.plan, applied: true };
}
