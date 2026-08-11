export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Webhooks } from "@dodopayments/nextjs";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { cacheInvalidate } from "@/lib/redis";

type AnyRecord = Record<string, any>;

/** Extract the Dodo customer id from any webhook payload shape. */
function getCustomerId(payload: AnyRecord): string | undefined {
  return (
    payload?.data?.customer_id ??
    payload?.data?.customer?.customer_id ??
    payload?.data?.subscription?.customer_id ??
    payload?.data?.payment?.customer_id
  );
}

/** Parse a credit amount string/number to a non-negative integer, or null when absent/invalid. */
function toCredits(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/**
 * Stable dedup key for a webhook. The Dodo envelope has no top-level `id`;
 * credit ledger events carry `data.id`, payments carry `data.payment_id`, etc.
 * The type prefix keeps distinct events that share an entity id apart.
 */
function resolveDodoEventId(payload: AnyRecord): string | undefined {
  const type = payload?.type ?? "unknown";
  const id =
    payload?.id ??
    payload?.data?.id ??
    payload?.data?.payment_id ??
    payload?.data?.subscription_id ??
    payload?.data?.refund_id ??
    payload?.data?.dispute_id ??
    payload?.data?.license_key_id;
  return id ? `${type}:${id}` : `${type}:${payload?.timestamp ?? ""}`;
}

async function invalidateUserCaches(userId: string): Promise<void> {
  await Promise.allSettled([
    cacheInvalidate(`cache:userplan:${userId}`),
    cacheInvalidate(`cache:credits:${userId}`),
  ]);
}

// ── Plan mapping from Dodo product IDs ──────────────────────────────────

type PlanId = "starter" | "pro" | "business";
type PlanInfo = { plan: PlanId; credits: number; monthlyLimit: number };

function planInfoFor(plan: PlanId): PlanInfo {
  return plan === "business"
    ? { plan: "business", credits: 50000, monthlyLimit: 50000 }
    : plan === "pro"
      ? { plan: "pro", credits: 15000, monthlyLimit: 15000 }
      : { plan: "starter", credits: 2500, monthlyLimit: 2500 };
}

function getDodoClient() {
  const dodoConfig = getDodoConfig();
  return new DodoPayments({
    bearerToken: dodoConfig.apiKey,
    environment: dodoConfig.environment as "test_mode" | "live_mode",
  });
}

async function resolvePlanFromProduct(productId: string | undefined, client: DodoPayments): Promise<PlanInfo | null> {
  if (!productId) return null;

  // 1) Env-configured product IDs (fast path)
  const mappings: [string, PlanId][] = [
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER_ID ?? "", "starter"],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO_ID ?? "", "pro"],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_BUSINESS_ID ?? "", "business"],
  ];

  for (const [pid, plan] of mappings) {
    if (pid && pid === productId) return planInfoFor(plan);
  }

  // 2) Authoritative fallback: read `metadata.plan` from the Dodo product.
  //    Product IDs are opaque and products may be recreated (new IDs), so the
  //    env map above can miss the product that was actually purchased.
  try {
    const product = (await client.products.retrieve(productId)) as AnyRecord;
    const metaPlan = product?.metadata?.plan;
    if (metaPlan === "starter" || metaPlan === "pro" || metaPlan === "business") {
      return planInfoFor(metaPlan);
    }
  } catch (err) {
    console.error(`[Dodo Webhook] Failed to fetch product ${productId}:`, (err as Error)?.message ?? err);
  }

  // 3) Fallback: try matching by plan name in product ID string
  const lower = productId.toLowerCase();
  if (lower.includes("business")) return planInfoFor("business");
  if (lower.includes("pro")) return planInfoFor("pro");
  if (lower.includes("starter")) return planInfoFor("starter");

  return null;
}

// ── User resolution ─────────────────────────────────────────────────────

async function resolveUserIdFromPayload(payload: AnyRecord): Promise<string | null> {
  const supabase = createServiceClient();

  const customerId: string | undefined = getCustomerId(payload);

  // 1) Prefer explicit user_id metadata from checkout
  const metaUserId: string | undefined =
    payload?.data?.metadata?.user_id ??
    payload?.data?.subscription?.metadata?.user_id ??
    payload?.data?.payment?.metadata?.user_id;

  if (metaUserId) return metaUserId;

  // 2) Fallback: dodo_customer_id mapping
  if (customerId) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("dodo_customer_id", customerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // 3) Fallback: match by customer email (legacy checkouts without metadata
  //    or before the customer mapping was written).
  const customerEmail: string | undefined =
    payload?.data?.customer?.email ??
    payload?.data?.subscription?.customer?.email ??
    payload?.data?.payment?.customer?.email;
  if (customerEmail) {
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("email", customerEmail)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

// ── Webhook event logging ───────────────────────────────────────────────

async function logWebhookEvent(eventType: string, payload: AnyRecord): Promise<boolean> {
  const supabase = createServiceClient();
  const dodoEventId = resolveDodoEventId(payload);

  // Check for duplicate
  if (dodoEventId) {
    const { data: existing } = await supabase
      .from("dodo_webhook_events")
      .select("id")
      .eq("dodo_event_id", dodoEventId)
      .maybeSingle();
    if (existing) {
      console.log(`[Dodo Webhook] Duplicate event ${dodoEventId}, skipping`);
      return false; // Already processed
    }
  }

  await supabase.from("dodo_webhook_events").insert({
    event_type: eventType,
    dodo_event_id: dodoEventId ?? null,
    payload,
    // onPayload runs before the event-type handlers, so record as received
    // rather than processed.
    status: "received",
  });

  return true;
}

// ── Customer mapping ────────────────────────────────────────────────────

async function upsertCustomerMapping(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const customerId = getCustomerId(payload);
  if (!customerId) return;

  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) {
    console.log("[Dodo Webhook] Could not resolve userId for customer mapping:", customerId);
    return;
  }

  const { error } = await supabase
    .from("users")
    .update({ dodo_customer_id: customerId })
    .eq("id", userId);

  if (error) {
    console.error("[Dodo Webhook] Failed to update dodo_customer_id:", error.message);
  } else {
    console.log(`[Dodo Webhook] Mapped customer ${customerId} → user ${userId}`);
  }
}

// ── Plan upgrade ────────────────────────────────────────────────────────

async function upgradePlan(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  // Only grant a plan when the user has actually paid. `subscription.updated`
  // fires on ANY field change — including while a checkout's subscription is
  // still `pending` (payment not yet collected) or `on_hold` (payment failed).
  // Subscription webhook payloads carry the authoritative `data.status`;
  // payment.succeeded payloads (Payment object) must not be gated on it.
  const isSubscriptionEvent = typeof payload?.type === "string" && payload.type.startsWith("subscription.");
  if (isSubscriptionEvent && payload?.data?.status !== "active") {
    console.log(
      `[Dodo Webhook] Skipping upgrade: subscription ${payload?.data?.subscription_id} is ${payload?.data?.status ?? "unknown"} (not paid)`
    );
    return;
  }

  const client = getDodoClient();

  // Try to get product ID from various payload locations. Payment payloads carry
  // product_cart instead of a top-level product_id; top-up products simply won't
  // match the plan map, so this fallback can't cause a false upgrade.
  let productId: string | undefined =
    payload?.data?.product_id ??
    payload?.data?.subscription?.product_id ??
    payload?.data?.items?.[0]?.product_id ??
    payload?.data?.line_items?.[0]?.product_id ??
    payload?.data?.product_cart?.[0]?.product_id;

  const subscriptionId: string | undefined =
    payload?.data?.subscription_id ??
    payload?.data?.subscription?.id;

  // Ignore subscription events for a subscription that isn't the user's current
  // one. A superseded subscription (replaced by a fresh checkout after a failed
  // changePlan) could otherwise re-apply an old plan when its late events fire
  // (e.g. its pending payment finally settling).
  if (isSubscriptionEvent && subscriptionId) {
    const { data: currentQuota } = await supabase
      .from("user_quotas")
      .select("dodo_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (
      currentQuota?.dodo_subscription_id &&
      currentQuota.dodo_subscription_id !== subscriptionId
    ) {
      console.log(
        `[Dodo Webhook] Skipping upgrade: event subscription ${subscriptionId} is not the current subscription ${currentQuota.dodo_subscription_id}`
      );
      return;
    }
  }

  // Some payment payloads omit the product cart; recover the product from the
  // subscription when a subscription_id is present.
  if (!productId && subscriptionId) {
    try {
      const sub = (await client.subscriptions.retrieve(subscriptionId)) as AnyRecord;
      productId = sub?.product_id ?? undefined;
    } catch (err) {
      console.error(`[Dodo Webhook] Failed to fetch subscription ${subscriptionId}:`, (err as Error)?.message ?? err);
    }
  }

  let planInfo = await resolvePlanFromProduct(productId, client);

  // Fallback: the plan selected at checkout (pending_plan/pending_product_id).
  // Webhooks can carry products that don't resolve via metadata/name mapping
  // (opaque or recreated IDs), so prefer the user's own intent when the product
  // matches. This makes the webhook self-healing instead of a silent no-op.
  if (!planInfo && userId) {
    try {
      const { data: pendingQuota } = await supabase
        .from("user_quotas")
        .select("pending_plan, pending_product_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (
        pendingQuota?.pending_plan &&
        pendingQuota?.pending_product_id === productId &&
        (pendingQuota.pending_plan === "starter" ||
          pendingQuota.pending_plan === "pro" ||
          pendingQuota.pending_plan === "business")
      ) {
        planInfo = planInfoFor(pendingQuota.pending_plan);
        console.log(`[Dodo Webhook] Using pending plan ${pendingQuota.pending_plan} for user ${userId}`);
      }
    } catch (pendingErr) {
      console.error("[Dodo Webhook] Failed to read pending plan:", (pendingErr as Error)?.message ?? pendingErr);
    }
  }

  if (!planInfo) {
    console.log(`[Dodo Webhook] No plan mapping for product: ${productId}`);
    return;
  }

  // If upgrading from free → paid and there are leftover free credits in credit_balance,
  // convert them into top_up_balance so they are preserved and consumed after monthly credits.
  try {
    const { data: existingQuota } = await supabase
      .from("user_quotas")
      .select("plan, credit_balance, top_up_balance")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingQuota && existingQuota.plan === "free") {
      const freeRemainder = Math.max(0, Number(existingQuota.credit_balance ?? 0));
      if (freeRemainder > 0) {
        const currentTopup = Math.max(0, Number(existingQuota.top_up_balance ?? 0));
        await supabase
          .from("user_quotas")
          .update({
            top_up_balance: currentTopup + freeRemainder,
            credit_balance: 0,
          })
          .eq("user_id", userId);
        console.log(`[Dodo Webhook] Preserved ${freeRemainder} free-credits as top-up for user ${userId}`);
      }
    }
  } catch (preserveErr) {
    console.error("[Dodo Webhook] Failed to preserve free credits as top-up:", (preserveErr as Error)?.message ?? preserveErr);
  }

  // Upsert only plan and metadata; do NOT mutate credit balances here to avoid double grants.
  // Credit balances are sourced authoritatively via syncCreditBalance() from Dodo.
  const { error } = await supabase
    .from("user_quotas")
    .upsert(
      {
        user_id: userId,
        plan: planInfo.plan,
        monthly_limit: planInfo.monthlyLimit,
        overage_enabled: true,
        dodo_subscription_id: subscriptionId ?? null,
        dodo_product_id: productId ?? null,
        pending_plan: null,
        pending_product_id: null,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[Dodo Webhook] Failed to upgrade plan:", error.message);
  } else {
    console.log(`[Dodo Webhook] Upgraded user ${userId} to ${planInfo.plan}`);
    await invalidateUserCaches(userId);
  }
}

// ── Credit sync from Dodo ───────────────────────────────────────────────

async function syncCreditBalance(payload: AnyRecord): Promise<void> {
  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  const supabase = createServiceClient();

  // Credit ledger webhooks (credit.added/deducted/...) include the authoritative
  // post-transaction balance — use it directly, no extra API call.
  const balanceAfter = toCredits(payload?.data?.balance_after);
  if (balanceAfter !== null) {
    await supabase
      .from("user_quotas")
      .update({ credit_balance: balanceAfter })
      .eq("user_id", userId);

    console.log(`[Dodo Webhook] Synced credit_balance for user ${userId}: ${balanceAfter}`);
    await invalidateUserCaches(userId);
    return;
  }

  // Otherwise fetch the authoritative balance from Dodo (payment events, etc.)
  const customerId = getCustomerId(payload);
  const creditEntitlementId: string | undefined =
    payload?.data?.credit_entitlement_id ??
    payload?.data?.entitlement_id ??
    process.env.DODO_CREDIT_ENTITLEMENT_ID;

  if (customerId && creditEntitlementId) {
    try {
      const client = getDodoClient();

      const balance = await client.creditEntitlements.balances.retrieve(
        customerId,
        { credit_entitlement_id: creditEntitlementId }
      );

      const newBalance = toCredits((balance as AnyRecord).balance);
      if (newBalance !== null) {
        await supabase
          .from("user_quotas")
          .update({ credit_balance: newBalance })
          .eq("user_id", userId);

        console.log(`[Dodo Webhook] Synced credits for user ${userId}: ${newBalance}`);
        await invalidateUserCaches(userId);
        return;
      }
    } catch (err) {
      console.error("[Dodo Webhook] Failed to fetch Dodo balance:", err);
    }
  }

  // Last resort: extract a balance field from the payload directly
  const fallback = toCredits(payload?.data?.available_balance ?? payload?.data?.credit_balance ?? payload?.data?.balance);
  if (fallback !== null) {
    await supabase
      .from("user_quotas")
      .update({ credit_balance: fallback })
      .eq("user_id", userId);
    console.log(`[Dodo Webhook] Updated credit balance for user ${userId}: ${fallback}`);
    await invalidateUserCaches(userId);
  }
}

// ── Downgrade to free ───────────────────────────────────────────────────

async function downgradeToFree(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) {
    console.log("[Dodo Webhook] Could not resolve userId for downgrade");
    return;
  }

  // Ignore events for a superseded subscription: a user who switched to a new
  // subscription (fresh checkout fallback) must not be downgraded when the old
  // subscription's cancellation/failure events arrive.
  const subscriptionId =
    payload?.data?.subscription_id ?? payload?.data?.subscription?.id;
  if (subscriptionId) {
    const { data: currentQuota } = await supabase
      .from("user_quotas")
      .select("dodo_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (
      currentQuota?.dodo_subscription_id &&
      currentQuota.dodo_subscription_id !== subscriptionId
    ) {
      console.log(
        `[Dodo Webhook] Skipping downgrade: event subscription ${subscriptionId} is not the current subscription ${currentQuota.dodo_subscription_id}`
      );
      return;
    }
  }

  const { error } = await supabase
    .from("user_quotas")
    .update({
      plan: "free",
      monthly_limit: 100,
      credit_balance: 0,
      credits_used_this_cycle: 0,
      credits_granted_this_cycle: 0,
      overage_enabled: false,
      dodo_subscription_id: null,
      dodo_product_id: null,
      pending_plan: null,
      pending_product_id: null,
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[Dodo Webhook] Failed to downgrade:", error.message);
  } else {
    console.log(`[Dodo Webhook] Downgraded user ${userId} to free`);
    await invalidateUserCaches(userId);
  }
}

// ── Superseded subscription cleanup ──────────────────────────────────────
//
// When a plan change is impossible (e.g. Dodo 409 PREVIOUS_PAYMENT_PENDING)
// the checkout route falls back to a fresh subscription checkout and tags the
// session with `cancel_previous_subscription_id`. Once that new subscription's
// first payment succeeds, cancel the old one so the user doesn't end up with
// parallel subscriptions / double billing.

async function cancelSupersededSubscription(payload: AnyRecord): Promise<void> {
  const metadata =
    payload?.data?.metadata ?? payload?.data?.payment?.metadata ?? {};
  const supersededId: unknown = metadata?.cancel_previous_subscription_id;
  if (typeof supersededId !== "string" || !supersededId) return;

  const currentSubId = payload?.data?.subscription_id ?? payload?.data?.subscription?.id;
  if (currentSubId === supersededId) return;

  const client = getDodoClient();
  try {
    await client.subscriptions.update(supersededId, {
      status: "cancelled",
      cancel_reason: "cancelled_by_merchant",
      cancellation_comment: "Superseded by a plan-upgrade checkout",
    });
    console.log(`[Dodo Webhook] Cancelled superseded subscription ${supersededId}`);
  } catch (err) {
    console.error(
      `[Dodo Webhook] Immediate cancel failed for ${supersededId}, scheduling cancellation at next billing date:`,
      (err as Error)?.message ?? err
    );
    try {
      await client.subscriptions.update(supersededId, {
        cancel_at_next_billing_date: true,
        cancel_reason: "cancelled_by_merchant",
        cancellation_comment: "Superseded by a plan-upgrade checkout",
      });
      console.log(
        `[Dodo Webhook] Scheduled cancellation of superseded subscription ${supersededId}`
      );
    } catch (err2) {
      console.error(
        `[Dodo Webhook] Failed to cancel superseded subscription ${supersededId}:`,
        (err2 as Error)?.message ?? err2
      );
    }
  }
}

// ── Low balance alert ───────────────────────────────────────────────────

async function recordLowBalanceAlert(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  const thresholdPct: number | undefined = payload?.data?.threshold_percent;

  await supabase.from("usage_alerts").insert({
    user_id: userId,
    alert_type: "quota_warning",
    threshold_pct: typeof thresholdPct === "number" ? thresholdPct : 80,
  });
}

// ── Webhook handler factory ─────────────────────────────────────────────

let _handler: ReturnType<typeof Webhooks> | null = null;

function getWebhookHandler() {
  if (!_handler) {
    _handler = Webhooks({
      webhookKey: getDodoConfig().webhookSecret,

      onPayload: async (payload: AnyRecord) => {
        const eventType = payload?.type ?? "unknown";
        console.log(`[Dodo Webhook] Received: ${eventType}`);
        await logWebhookEvent(eventType, payload);
      },

      // ── Payments ──────────────────────────────────────────────
      onPaymentSucceeded: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payment succeeded");
        await upsertCustomerMapping(payload);
        // On first payment, upgrade plan based on product (if it's a subscription product)
        await upgradePlan(payload);
        // Sync the authoritative balance. One-time top-up products grant credits
        // on the entitlement directly, so this folds them into credit_balance
        // without double-counting.
        await syncCreditBalance(payload);
        // If this payment activated a replacement subscription, retire the old
        // one so the user isn't left with parallel subscriptions.
        await cancelSupersededSubscription(payload);
      },

      onPaymentProcessing: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payment processing");
      },

      onPaymentFailed: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payment failed");
      },

      onPaymentCancelled: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payment cancelled");
      },

      // ── Refunds ───────────────────────────────────────────────
      onRefundSucceeded: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Refund succeeded");
        // Refunds reverse credit grants (credit.deducted also fires), so resync.
        await syncCreditBalance(payload);
      },

      onRefundFailed: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Refund failed");
      },

      // ── Abandoned checkout ────────────────────────────────────
      onAbandonedCheckoutDetected: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Abandoned checkout detected");
      },

      onAbandonedCheckoutRecovered: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Abandoned checkout recovered");
      },

      // ── Subscriptions ────────────────────────────────────────
      onSubscriptionActive: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription active");
        await upsertCustomerMapping(payload);
        await upgradePlan(payload);
      },

      onSubscriptionOnHold: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription on hold");
        // Renewal/plan-change payment failed on an active subscription. The user
        // is not paying anymore, so revoke the paid plan to avoid granting
        // access without payment.
        await downgradeToFree(payload);
      },

      onSubscriptionCancelled: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription cancelled");
        await downgradeToFree(payload);
      },

      onSubscriptionRenewed: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription renewed");
        await upsertCustomerMapping(payload);
      },

      onSubscriptionFailed: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription failed");
        // Initial mandate failed at subscription creation — terminal. Make sure
        // the user never ends up on a paid plan from a never-paid subscription.
        await downgradeToFree(payload);
      },

      onSubscriptionExpired: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription expired");
        await downgradeToFree(payload);
      },

      onSubscriptionUpdated: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription updated");
        await upsertCustomerMapping(payload);
        await upgradePlan(payload);
      },

      onSubscriptionPlanChanged: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription plan changed");
        await upsertCustomerMapping(payload);
        await upgradePlan(payload);
      },

      onSubscriptionUpdatePaymentMethod: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription update payment method");
      },

      // ── Payouts (merchant-side; informational only) ───────────
      onPayoutSuccess: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payout success");
      },

      onPayoutFailed: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payout failed");
      },

      onPayoutInProgress: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payout in progress");
      },

      onPayoutOnHold: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payout on hold");
      },

      // ── Credits ──────────────────────────────────────────────
      onCreditAdded: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Credits added");
        await syncCreditBalance(payload);
      },

      onCreditDeducted: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Credits deducted");
        await syncCreditBalance(payload);
      },

      onCreditExpired: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Credits expired");
        await syncCreditBalance(payload);
      },

      onCreditRolledOver: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Credits rolled over");
        await syncCreditBalance(payload);
      },

      onCreditRolloverForfeited: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Credit rollover forfeited");
        await syncCreditBalance(payload);
      },

      onCreditOverageCharged: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Overage charged");
        await syncCreditBalance(payload);
      },

      onCreditOverageReset: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Overage reset");
        await syncCreditBalance(payload);
      },

      onCreditManualAdjustment: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Credit manual adjustment");
        await syncCreditBalance(payload);
      },

      onCreditBalanceLow: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Credit balance low");
        await recordLowBalanceAlert(payload);
      },
    });
  }
  return _handler;
}

export async function POST(request: NextRequest) {
  return getWebhookHandler()(request);
}
