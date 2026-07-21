import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";

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
      body.return_url ?? dodoConfig.returnUrlSuccess ?? "http://localhost:3000/dashboard/plan?upgraded=1";

    const client = new DodoPayments({
      bearerToken: dodoConfig.apiKey,
      environment: dodoConfig.environment as "test_mode" | "live_mode",
    });

    // Auto-fill customer info from Clerk
    let customerInfo: { email: string; name?: string } | undefined;
    try {
      const clerkUser = await currentUser();
      if (clerkUser) {
        const email = clerkUser.emailAddresses?.[0]?.emailAddress;
        const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
        if (email) {
          customerInfo = { email, name: name || undefined };
        }
      }
    } catch {
      // Continue without customer info
    }

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity }],
      customer: customerInfo,
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
