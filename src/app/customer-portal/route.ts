import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opens the Dodo customer portal for the signed-in user.
 * Customer IDs are looked up server-side — never taken from the query string.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const supabase = createServiceClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("dodo_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const customerId = userRow?.dodo_customer_id;
  if (!customerId) {
    return NextResponse.redirect(new URL("/dashboard/plan", request.url));
  }

  const cfg = getDodoConfig();
  const client = new DodoPayments({
    bearerToken: cfg.apiKey,
    environment: cfg.environment as "test_mode" | "live_mode",
  });

  try {
    const session = await client.customers.customerPortal.create(customerId, {
      return_url: new URL("/dashboard/plan", request.url).toString(),
    });
    if (!session.link) {
      return new NextResponse("Customer portal is unavailable right now.", { status: 502 });
    }
    return NextResponse.redirect(session.link);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[customer-portal] Failed to create session:", message);
    return new NextResponse("Failed to open customer portal.", { status: 500 });
  }
}
