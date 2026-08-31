import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "./dashboard-client";
import { ensureWelcomeCredits } from "@/lib/credits";
import { getUserPlan } from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";
import { checkDashboardDataAccess, type DashboardAccessStatus } from "@/app/actions/dashboard-access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Defense-in-depth: proxy.ts already redirects signed-out visitors away
  // from /dashboard, but the layout shouldn't rely solely on the middleware
  // matcher never changing. Every page under /dashboard also checks this
  // independently before rendering any data.
  if (!userId) redirect("/sign-in");

  let plan = "free";
  let currentProductId: string | undefined;
  let isAdmin = false;
  let dataAccess: DashboardAccessStatus = { ok: true };
  if (userId) {
    // Run the (near-always no-op) credit seed in parallel with the plan lookup,
    // which is itself Redis-cached for 60s, so navigation never waits on two
    // sequential round-trips before rendering the page shell.
    try {
      const supabase = createServiceClient();
      const [resolvedPlan, , adminFlag, access, quotaRow] = await Promise.all([
        getUserPlan(userId).catch(() => "free" as const),
        ensureWelcomeCredits(userId).catch(() => {}),
        isAdminUser(userId).catch(() => false),
        checkDashboardDataAccess(userId).catch(() => ({
          ok: false as const,
          issue: "database_error" as const,
          message: "Failed to verify dashboard data access.",
        })),
        supabase
          .from("user_quotas")
          .select("dodo_product_id")
          .eq("user_id", userId)
          .maybeSingle()
          .then((res) => res.data, () => null),
      ]);
      plan = resolvedPlan;
      isAdmin = adminFlag;
      dataAccess = access;
      currentProductId = quotaRow?.dodo_product_id ?? undefined;
    } catch {
      plan = "free";
    }
  }

  return (
    <DashboardLayoutClient plan={plan} currentProductId={currentProductId} isAdmin={isAdmin} dataAccess={dataAccess}>
      {children}
    </DashboardLayoutClient>
  );
}
