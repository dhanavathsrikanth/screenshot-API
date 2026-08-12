import { auth } from "@clerk/nextjs/server";
import { DashboardLayoutClient } from "./dashboard-client";
import { ensureWelcomeCredits } from "@/lib/credits";
import { getUserPlan } from "@/lib/plans";
import { isAdminUser } from "@/lib/admin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  let plan = "free";
  let isAdmin = false;
  if (userId) {
    // Run the (near-always no-op) credit seed in parallel with the plan lookup,
    // which is itself Redis-cached for 60s, so navigation never waits on two
    // sequential round-trips before rendering the page shell.
    try {
      [plan, , isAdmin] = await Promise.all([
        getUserPlan(userId).catch(() => "free" as const),
        ensureWelcomeCredits(userId).catch(() => {}),
        isAdminUser(userId).catch(() => false),
      ]);
    } catch {
      plan = "free";
    }
  }

  return (
    <DashboardLayoutClient plan={plan} isAdmin={isAdmin}>
      {children}
    </DashboardLayoutClient>
  );
}
