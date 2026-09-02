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
 * Supports both GET (direct redirect) and POST (JSON with portal URL).
 */
async function createPortalSession(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const supabase = createServiceClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("dodo_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const customerId = userRow?.dodo_customer_id;
  if (!customerId) {
    return { error: "No billing profile", status: 404 as const, noCustomer: true };
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
      return { error: "Portal unavailable", status: 502 as const };
    }
    return { link: session.link as string };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[customer-portal] Failed to create session:", message);
    return { error: "Failed to open portal", status: 500 as const };
  }
}

export async function GET(request: NextRequest) {
  const result = await createPortalSession(request);
  if ("link" in result && result.link) {
    return NextResponse.redirect(result.link);
  }
  if ("noCustomer" in result && result.noCustomer) {
    return NextResponse.redirect(new URL("/dashboard/plan", request.url));
  }
  if ("status" in result && result.status === 401) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return new NextResponse((result as { error: string }).error ?? "Error", { status: (result as { status: number }).status ?? 500 });
}

export async function POST(request: NextRequest) {
  const result = await createPortalSession(request);
  if ("link" in result) {
    return NextResponse.json({ url: result.link });
  }
  return NextResponse.json({ error: (result as { error: string }).error }, { status: (result as { status: number }).status });
}
