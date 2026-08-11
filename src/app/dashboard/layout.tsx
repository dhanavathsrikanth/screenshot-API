import { auth } from "@clerk/nextjs/server";
import { DashboardLayoutClient } from "./dashboard-client";
import { ensureWelcomeCredits } from "@/lib/credits";
import { getUserPlan } from "@/lib/plans";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  let plan = "free";
  if (userId) {
    // Run the (near-always no-op) credit seed in parallel with the plan lookup,
    // which is itself Redis-cached for 60s, so navigation never waits on two
    // sequential round-trips before rendering the page shell.
    try {
      [plan] = await Promise.all([
        getUserPlan(userId).catch(() => "free" as const),
        ensureWelcomeCredits(userId).catch(() => {}),
      ]);
    } catch {
      plan = "free";
    }
  }

  return <DashboardLayoutClient plan={plan}>{children}</DashboardLayoutClient>;
}
