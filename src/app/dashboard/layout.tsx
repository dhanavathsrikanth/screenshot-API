import { auth } from "@clerk/nextjs/server";
import { DashboardLayoutClient } from "./dashboard-client";
import { ensureWelcomeCredits } from "@/lib/credits";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Seed 100 welcome credits for new users or legacy users missing credits
  if (userId) {
    try {
      await ensureWelcomeCredits(userId);
    } catch {
      // non-fatal
    }
  }

  let plan = "free";
  if (userId) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data } = await supabase
        .from("user_quotas")
        .select("plan")
        .eq("user_id", userId)
        .single();
      plan = data?.plan ?? "free";
    } catch {
      // fallback to free
    }
  }

  return <DashboardLayoutClient plan={plan}>{children}</DashboardLayoutClient>;
}
