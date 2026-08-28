import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/posthog";
import { resolvePlanFromDodoProduct, PLAN_PRICES } from "@/lib/plans";

type CheckoutBody = {
  product_id?: string;
  quantity?: number;
  return_url?: string;
  metadata?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CheckoutBody;
    const productId = body.product_id;
    if (!productId) {
      return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
    }

    const quantity = Math.max(1, Number(body.quantity ?? 1));
    const dodoConfig = getDodoConfig();
    const returnUrl =
      body.return_url || dodoConfig.returnUrlSuccess || "http://localhost:3000/dashboard/plan?upgraded=1";

    const client = new DodoPayments({
      bearerToken: dodoConfig.apiKey,
      environment: dodoConfig.environment as "test_mode" | "live_mode",
    });

    const supabase = createServiceClient();
    const { data: quota } = await supabase
      .from("user_quotas")
      .select("plan, dodo_subscription_id")
      .eq("user_id", userId)
      .maybeSingle();

    const requested = await resolvePlanFromDodoProduct(productId, (id) => client.products.retrieve(id));

    // Record the selected plan before checkout. If the Dodo webhook is missed,
    // fails, or can't map the product, the pending markers let the webhook and
    // the ?upgraded=1 page reconciliation apply the plan anyway.
    if (requested) {
      await supabase
        .from("user_quotas")
        .update({ pending_plan: requested.plan, pending_product_id: productId })
        .eq("user_id", userId);
    }

    // Paid → paid plan change: swap the existing subscription in place instead
    // of creating a parallel subscription (which would double-bill the customer).
    // Dodo only supports this for active subscriptions, so verify status first.
    let supersededSubscriptionId: string | undefined;

    if (
      requested &&
      quota?.plan &&
      quota.dodo_subscription_id &&
      quota.plan !== "free" &&
      quota.plan !== requested.plan
    ) {
      const proration: "prorated_immediately" | "do_not_bill" =
        requested.price > (PLAN_PRICES[quota.plan as keyof typeof PLAN_PRICES] ?? 0)
          ? "prorated_immediately"
          : "do_not_bill";

      let existingStatus: string | null = null;
      try {
        const existingSub = await client.subscriptions.retrieve(quota.dodo_subscription_id);
        existingStatus = (existingSub as { status?: string }).status ?? null;
      } catch {
        console.log(
          "[checkout] Existing subscription not found, falling back to a new checkout:",
          quota.dodo_subscription_id
        );
      }

      if (existingStatus === "active") {
        try {
          await client.subscriptions.changePlan(quota.dodo_subscription_id, {
            product_id: productId,
            proration_billing_mode: proration,
            quantity: 1,
          });

          // Best-effort immediate DB sync; the subscription.plan_changed webhook is
          // the authoritative source and will re-apply the same values.
          await supabase
            .from("user_quotas")
            .update({
              plan: requested.plan,
              monthly_limit: requested.monthlyLimit,
              dodo_product_id: productId,
            })
            .eq("user_id", userId);

          await trackServerEvent({
            userId,
            event: "subscription_plan_changed",
            properties: { plan: requested.plan },
          }).catch(() => {});

          return NextResponse.json(
            { changed: true, plan: requested.plan, checkout_url: returnUrl },
            { status: 200 }
          );
        } catch (err) {
          // Dodo rejects the swap when the subscription has an unsettled payment
          // (409 PREVIOUS_PAYMENT_PENDING), is on-hold/failed/expired, etc. Don't
          // dead-end the upgrade — fall back to a fresh subscription checkout below
          // and tag the session so the webhook cancels the old subscription after
          // the new payment succeeds (avoids parallel subscriptions / double billing).
          console.error(
            "[checkout] changePlan failed, falling back to a fresh checkout:",
            err
          );
          supersededSubscriptionId = quota.dodo_subscription_id;
        }
      } else {
        console.log(
          `[checkout] Existing subscription is ${existingStatus ?? "unknown"}; creating a new checkout instead of changePlan`
        );
        supersededSubscriptionId = quota.dodo_subscription_id;
      }
    }

    // Reuse the existing Dodo customer when known so the credit entitlement
    // stays attached to the same customer across checkouts.
    let customer: { customer_id: string } | { email: string; name?: string } | undefined;
    const { data: userRow } = await supabase
      .from("users")
      .select("dodo_customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (userRow?.dodo_customer_id) {
      customer = { customer_id: userRow.dodo_customer_id };
    } else {
      try {
        const clerkUser = await currentUser();
        if (clerkUser) {
          // Use the primary email: the Clerk webhook stores `users.email` from
          // the primary address, so a non-primary address here would fail the
          // webhook's email-based user resolution on first purchase.
          const email =
            clerkUser.primaryEmailAddress?.emailAddress ??
            clerkUser.emailAddresses?.[0]?.emailAddress;
          const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
          if (email) {
            customer = { email, name: name || undefined };
          }
        }
      } catch {
        // Continue without customer info
      }
    }

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity }],
      customer,
      return_url: returnUrl,
      metadata: {
        ...(body.metadata ?? {}),
        user_id: userId,
        ...(supersededSubscriptionId
          ? { cancel_previous_subscription_id: supersededSubscriptionId }
          : {}),
      } as Record<string, string>,
    });

    // Conversion funnel: checkout_started (blueprint §16).
    await trackServerEvent({
      userId,
      event: "checkout_started",
      properties: {
        product_id: productId,
        plan: requested?.plan ?? null,
        quantity,
      },
    }).catch(() => {});

    return NextResponse.json(
      {
        checkout_url: session.checkout_url ?? null,
        session_id: session.session_id,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
