export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Webhooks } from "@dodopayments/nextjs";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

type AnyRecord = Record<string, any>;

// ── Plan mapping from Dodo product IDs ──────────────────────────────────

const PRODUCT_PLAN_MAP: Record<string, { plan: string; credits: number; monthlyLimit: number }> = {};

// ── Top-up mapping from Dodo product IDs ─────────────────────────────────
function resolveTopupFromProduct(productId: string | undefined): number | null {
  if (!productId) return null;

  const TOPUPS: [string | undefined, number][] = [
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_TOPUP_500_ID, 500],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_TOPUP_2500_ID, 2500],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_TOPUP_10000_ID, 10000],
  ];

  for (const [pid, credits] of TOPUPS) {
    if (pid && pid === productId) return credits;
  }

  // Fallback: try to infer from id string
  const lower = productId.toLowerCase();
  if (lower.includes("10000")) return 10000;
  if (lower.includes("2500")) return 2500;
  if (lower.includes("500")) return 500;

  return null;
}

function resolvePlanFromProduct(productId: string | undefined): { plan: string; credits: number; monthlyLimit: number } | null {
  if (!productId) return null;

  // Check env-based product IDs
  const mappings: [string, string][] = [
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER_ID ?? "", "starter"],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO_ID ?? "", "pro"],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_BUSINESS_ID ?? "", "business"],
  ];

  for (const [pid, plan] of mappings) {
    if (pid && pid === productId) {
      return plan === "business"
        ? { plan: "business", credits: 50000, monthlyLimit: 50000 }
        : plan === "pro"
          ? { plan: "pro", credits: 15000, monthlyLimit: 15000 }
          : { plan: "starter", credits: 2500, monthlyLimit: 2500 };
    }
  }

  // Fallback: try matching by plan name in product ID string
  const lower = productId.toLowerCase();
  if (lower.includes("business")) return { plan: "business", credits: 50000, monthlyLimit: 50000 };
  if (lower.includes("pro")) return { plan: "pro", credits: 15000, monthlyLimit: 15000 };
  if (lower.includes("starter")) return { plan: "starter", credits: 2500, monthlyLimit: 2500 };

  return null;
}

// ── User resolution ─────────────────────────────────────────────────────

async function resolveUserIdFromPayload(payload: AnyRecord): Promise<string | null> {
  const supabase = createServiceClient();

  const customerId: string | undefined =
    payload?.data?.customer_id ??
    payload?.data?.subscription?.customer_id ??
    payload?.data?.payment?.customer_id;

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

  return null;
}

// ── Webhook event logging ───────────────────────────────────────────────

async function logWebhookEvent(eventType: string, payload: AnyRecord, dodoEventId?: string): Promise<boolean> {
  const supabase = createServiceClient();

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
    status: "processed",
  });

  return true;
}

// ── Customer mapping ────────────────────────────────────────────────────

async function upsertCustomerMapping(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const customerId: string | undefined =
    payload?.data?.customer_id ??
    payload?.data?.subscription?.customer_id ??
    payload?.data?.payment?.customer_id;
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

  // Try to get product ID from various payload locations
  const productId: string | undefined =
    payload?.data?.product_id ??
    payload?.data?.subscription?.product_id ??
    payload?.data?.items?.[0]?.product_id ??
    payload?.data?.line_items?.[0]?.product_id;

  const planInfo = resolvePlanFromProduct(productId);
  if (!planInfo) {
    console.log(`[Dodo Webhook] No plan mapping for product: ${productId}`);
    return;
  }

  const subscriptionId: string | undefined =
    payload?.data?.subscription_id ??
    payload?.data?.subscription?.id;

  // Upsert plan + credits + monthly limit to ensure a row exists
  const { error } = await supabase
    .from("user_quotas")
    .upsert(
      {
        user_id: userId,
        plan: planInfo.plan,
        monthly_limit: planInfo.monthlyLimit,
        credit_balance: planInfo.credits,
        credits_granted_this_cycle: planInfo.credits,
        credits_used_this_cycle: 0,
        overage_enabled: true,
        dodo_subscription_id: subscriptionId ?? null,
        dodo_product_id: productId ?? null,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[Dodo Webhook] Failed to upgrade plan:", error.message);
  } else {
    console.log(`[Dodo Webhook] Upgraded user ${userId} to ${planInfo.plan} (${planInfo.credits} credits)`);
  }
}

// ── Credit sync from Dodo ───────────────────────────────────────────────

async function syncCreditBalance(payload: AnyRecord): Promise<void> {
  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  const supabase = createServiceClient();

  let creditEntitlementId: string | undefined =
    payload?.data?.credit_entitlement_id ?? payload?.data?.entitlement_id;
  const customerId: string | undefined = payload?.data?.customer_id;

  // Fallback to configured entitlement if not present in payload
  if (!creditEntitlementId) {
    creditEntitlementId = process.env.DODO_CREDIT_ENTITLEMENT_ID;
  }

  // If we have a customer + entitlement, fetch authoritative balance from Dodo
  if (creditEntitlementId && customerId) {
    try {
      const dodoConfig = getDodoConfig();
      const client = new DodoPayments({
        bearerToken: dodoConfig.apiKey,
        environment: dodoConfig.environment as "test_mode" | "live_mode",
      });

      const balance = await client.creditEntitlements.balances.retrieve(
        customerId,
        { credit_entitlement_id: creditEntitlementId }
      );

      const newBalance = parseInt((balance as AnyRecord).balance ?? "0", 10);

      const { data: quota } = await supabase
        .from("user_quotas")
        .select("credit_balance")
        .eq("user_id", userId)
        .maybeSingle();

      const currentBalance = quota?.credit_balance ?? 0;
      const delta = newBalance - currentBalance;

      const update: AnyRecord = { credit_balance: newBalance };
      if (delta > 0) {
        const { data: q2 } = await supabase
          .from("user_quotas")
          .select("credits_granted_this_cycle")
          .eq("user_id", userId)
          .maybeSingle();
        update.credits_granted_this_cycle = (q2?.credits_granted_this_cycle ?? 0) + delta;
      } else if (delta < 0) {
        const { data: q2 } = await supabase
          .from("user_quotas")
          .select("credits_used_this_cycle")
          .eq("user_id", userId)
          .maybeSingle();
        update.credits_used_this_cycle = (q2?.credits_used_this_cycle ?? 0) + Math.abs(delta);
      }

      await supabase.from("user_quotas").update(update).eq("user_id", userId);
      console.log(`[Dodo Webhook] Synced credits for user ${userId}: ${currentBalance} → ${newBalance}`);
      return;
    } catch (err) {
      console.error("[Dodo Webhook] Failed to fetch Dodo balance:", err);
    }
  }

  // Fallback: try to extract balance from payload directly
  const newBalance: number | undefined =
    payload?.data?.balance ??
    payload?.data?.available_balance ??
    payload?.data?.credit_balance;

  if (typeof newBalance === "number") {
    await supabase
      .from("user_quotas")
      .update({ credit_balance: newBalance })
      .eq("user_id", userId);
    console.log(`[Dodo Webhook] Updated credit balance for user ${userId}: ${newBalance}`);
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
    })
    .eq("user_id", userId);

  if (error) {
    console.error("[Dodo Webhook] Failed to downgrade:", error.message);
  } else {
    console.log(`[Dodo Webhook] Downgraded user ${userId} to free`);
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

// ── Top-up credit grant (one-time purchases) ─────────────────────────────
async function grantTopupCredits(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  const productId: string | undefined =
    payload?.data?.product_id ??
    payload?.data?.items?.[0]?.product_id ??
    payload?.data?.line_items?.[0]?.product_id;

  const credits = resolveTopupFromProduct(productId);
  if (!credits) return;

  const { data: q } = await supabase
    .from("user_quotas")
    .select("top_up_balance")
    .eq("user_id", userId)
    .maybeSingle();

  const currentTopup = q?.top_up_balance ?? 0;
  const nextTopup = currentTopup + credits;

  const { error } = await supabase
    .from("user_quotas")
    .upsert(
      {
        user_id: userId,
        top_up_balance: nextTopup,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[Dodo Webhook] Failed to grant top-up credits:", error.message);
  } else {
    console.log(`[Dodo Webhook] Granted top-up credits to user ${userId}: +${credits} (now ${nextTopup})`);
  }
}

function getWebhookHandler() {
  if (!_handler) {
    _handler = Webhooks({
      webhookKey: getDodoConfig().webhookSecret,

      onPayload: async (payload: AnyRecord) => {
        const eventType = payload?.type ?? "unknown";
        const dodoEventId = payload?.id;
        console.log(`[Dodo Webhook] Received: ${eventType} (id: ${dodoEventId})`);
        await logWebhookEvent(eventType, payload, dodoEventId);
      },

      // ── Payments ──────────────────────────────────────────────
      onPaymentSucceeded: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payment succeeded");
        await upsertCustomerMapping(payload);
        // On first payment, upgrade plan based on product (if it's a subscription product)
        await upgradePlan(payload);
        // Also grant top-up credits for one-time credit products
        await grantTopupCredits(payload);
        // Attempt to sync authoritative balance as a final step
        await syncCreditBalance(payload);
      },

      onPaymentFailed: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Payment failed");
      },

      // ── Subscriptions ────────────────────────────────────────
      onSubscriptionActive: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription active");
        await upsertCustomerMapping(payload);
        await upgradePlan(payload);
      },

      onSubscriptionCancelled: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription cancelled");
        await downgradeToFree(payload);
      },

      onSubscriptionRenewed: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook] Subscription renewed");
        await upsertCustomerMapping(payload);
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
