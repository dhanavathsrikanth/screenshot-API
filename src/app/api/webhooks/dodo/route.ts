import { NextRequest, NextResponse } from "next/server";
import { Webhooks } from "@dodopayments/nextjs";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

type AnyRecord = Record<string, any>;

async function resolveUserIdFromPayload(payload: AnyRecord): Promise<string | null> {
  const supabase = createServiceClient();

  const customerId: string | undefined =
    payload?.data?.customer_id ?? payload?.data?.subscription?.customer_id ?? payload?.data?.payment?.customer_id;

  // 1) Prefer explicit user_id metadata that we set at checkout time
  const metaUserId: string | undefined =
    payload?.data?.metadata?.user_id ??
    payload?.data?.subscription?.metadata?.user_id ??
    payload?.data?.payment?.metadata?.user_id;

  if (metaUserId) return metaUserId;

  // 2) Fallback to users.dodo_customer_id mapping
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

async function upsertCustomerMapping(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const customerId: string | undefined =
    payload?.data?.customer_id ?? payload?.data?.subscription?.customer_id ?? payload?.data?.payment?.customer_id;
  if (!customerId) return;

  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  await supabase
    .from("users")
    .update({ dodo_customer_id: customerId })
    .eq("id", userId);
}

// Fetch the authoritative credit balance from Dodo for this customer+entitlement and sync our DB.
async function syncCreditBalanceFromDodo(payload: AnyRecord): Promise<void> {
  const creditEntitlementId: string | undefined =
    payload?.data?.credit_entitlement_id ?? payload?.data?.entitlement_id;

  const customerId: string | undefined = payload?.data?.customer_id;
  if (!creditEntitlementId || !customerId) return;

  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  const supabase = createServiceClient();

  const dodoConfig = getDodoConfig();
  const client = new DodoPayments({
    bearerToken: dodoConfig.apiKey,
    environment: dodoConfig.environment as "test_mode" | "live_mode",
  });

   // Retrieve authoritative balance
   const balance = await client.creditEntitlements.balances.retrieve(
     customerId,
     { credit_entitlement_id: creditEntitlementId }
   );

  const newBalance = parseInt((balance as AnyRecord).balance ?? "0", 10);

  // Read current local counters
  const { data: quota } = await supabase
    .from("user_quotas")
    .select("credit_balance, credits_granted_this_cycle, credits_used_this_cycle, top_up_balance, plan")
    .eq("user_id", userId)
    .maybeSingle();

  const currentBalance = quota?.credit_balance ?? 0;
  const delta = newBalance - currentBalance;

  // Update: set absolute balance; adjust granted/used counters based on delta sign
  const update: AnyRecord = {
    credit_balance: newBalance,
  };
  if (delta > 0) {
    update.credits_granted_this_cycle = (quota?.credits_granted_this_cycle ?? 0) + delta;
  } else if (delta < 0) {
    update.credits_used_this_cycle = (quota?.credits_used_this_cycle ?? 0) + Math.abs(delta);
  }

  await supabase.from("user_quotas").update(update).eq("user_id", userId);
}

async function recordLowBalanceAlert(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  const available: string | number | undefined = payload?.data?.available_balance;
  const thresholdPct: number | undefined = payload?.data?.threshold_percent;

  await supabase.from("usage_alerts").insert({
    user_id: userId,
    alert_type: "quota_warning",
    threshold_pct: typeof thresholdPct === "number" ? thresholdPct : 80,
  });
}

async function downgradeToFree(payload: AnyRecord): Promise<void> {
  const supabase = createServiceClient();
  const userId = await resolveUserIdFromPayload(payload);
  if (!userId) return;

  await supabase
    .from("user_quotas")
    .update({
      plan: "free",
      overage_enabled: false,
      monthly_limit: 100,
    })
    .eq("user_id", userId);
}

let _handler: ReturnType<typeof Webhooks> | null = null;

function getWebhookHandler() {
  if (!_handler) {
    _handler = Webhooks({
      webhookKey: getDodoConfig().webhookSecret,
      onPayload: async (payload: AnyRecord) => {
        console.log("[Dodo Webhook]", payload?.type);
      },
      onPaymentSucceeded: async (payload: AnyRecord) => {
        await upsertCustomerMapping(payload);
      },
      onSubscriptionActive: async (payload: AnyRecord) => {
        await upsertCustomerMapping(payload);
      },
      onSubscriptionCancelled: async (payload: AnyRecord) => {
        await downgradeToFree(payload);
      },
      onCreditAdded: async (payload: AnyRecord) => {
        await syncCreditBalanceFromDodo(payload);
      },
      onCreditDeducted: async (payload: AnyRecord) => {
        await syncCreditBalanceFromDodo(payload);
      },
      onCreditExpired: async (payload: AnyRecord) => {
        await syncCreditBalanceFromDodo(payload);
      },
      onCreditRolledOver: async (payload: AnyRecord) => {
        await syncCreditBalanceFromDodo(payload);
      },
      onCreditRolloverForfeited: async (payload: AnyRecord) => {
        await syncCreditBalanceFromDodo(payload);
      },
      onCreditOverageCharged: async (payload: AnyRecord) => {
        await syncCreditBalanceFromDodo(payload);
      },
      onCreditBalanceLow: async (payload: AnyRecord) => {
        await recordLowBalanceAlert(payload);
      },
    });
  }
  return _handler;
}

export async function POST(request: NextRequest) {
  return getWebhookHandler()(request);
}