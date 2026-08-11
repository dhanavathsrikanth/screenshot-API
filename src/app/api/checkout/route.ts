import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

type CheckoutBody = {
  product_id?: string;
  quantity?: number;
  return_url?: string;
  metadata?: Record<string, string>;
};

const PLAN_PRICES: Record<string, number> = { free: 0, starter: 9, pro: 49, business: 149 };
const PLAN_LIMITS: Record<string, number> = { starter: 2500, pro: 15000, business: 50000 };

function resolvePlanFromProduct(
  productId: string | undefined,
  client?: DodoPayments
): Promise<{ plan: string; monthlyLimit: number; price: number } | null> {
  if (!productId) return Promise.resolve(null);

  const match = (plan: string) => ({ plan, monthlyLimit: PLAN_LIMITS[plan] ?? 0, price: PLAN_PRICES[plan] ?? 0 });

  // 1) Env-configured product IDs (fast path)
  const mappings: [string, string][] = [
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER_ID ?? "", "starter"],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO_ID ?? "", "pro"],
    [process.env.NEXT_PUBLIC_DODO_PRODUCT_BUSINESS_ID ?? "", "business"],
  ];

  for (const [pid, plan] of mappings) {
    if (pid && pid === productId) return Promise.resolve(match(plan));
  }

  // 2) Authoritative fallback: read `metadata.plan` from the Dodo product.
  //    Product IDs are opaque and products may be recreated (new IDs), so the
  //    env map above can miss the product the user actually selected.
  if (client) {
    return client.products
      .retrieve(productId)
      .then((product: { metadata?: { plan?: string } }) => {
        const metaPlan = product?.metadata?.plan;
        if (metaPlan === "starter" || metaPlan === "pro" || metaPlan === "business") {
          return match(metaPlan);
        }
        return null;
      })
      .catch(() => null);
  }

  return Promise.resolve(null);
}

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

    const requested = await resolvePlanFromProduct(productId, client);

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
    if (
      requested &&
      quota?.plan &&
      quota.dodo_subscription_id &&
      quota.plan !== "free" &&
      quota.plan !== requested.plan
    ) {
      const proration: "prorated_immediately" | "do_not_bill" =
        requested.price > (PLAN_PRICES[quota.plan] ?? 0) ? "prorated_immediately" : "do_not_bill";

      // Only swap an actually-active subscription. Users hit by the earlier
      // false-upgrade bug (or abandoned checkouts) can hold a
      // dodo_subscription_id pointing at a pending/on_hold/failed/missing
      // subscription — Dodo's changePlan rejects it with a 400 and dead-ends
      // the upgrade flow. Fall back to a fresh checkout in that case.
      let existingStatus: string | null = null;
      try {
        const existingSub = await client.subscriptions.retrieve(quota.dodo_subscription_id);
        existingStatus = (existingSub as { status?: string }).status ?? null;
      } catch {
        console.log(
          "[checkout] Existing subscription not found, creating a new checkout:",
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

          return NextResponse.json(
            { changed: true, plan: requested.plan, checkout_url: returnUrl },
            { status: 200 }
          );
        } catch (err) {
          // Fail closed: never fall back to a regular checkout here, or the user
          // would end up with a second, parallel subscription (double billing).
          console.error("[checkout] changePlan failed:", err);
          return NextResponse.json(
            {
              error:
                "Couldn't switch your plan. Please update your payment method, then try again.",
            },
            { status: 400 }
          );
        }
      }

      console.log(
        `[checkout] Existing subscription is ${existingStatus ?? "unknown"}; creating a new checkout instead of changePlan`
      );
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
        user_id: userId,
        ...(body.metadata ?? {}),
      } as Record<string, string>,
    });

    return NextResponse.json(
      {
        checkout_url: (session as any).checkout_url,
        session_id: (session as any).session_id,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
