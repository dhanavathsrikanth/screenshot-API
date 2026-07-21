import { auth } from "@clerk/nextjs/server";
import { DashboardLayoutClient } from "./dashboard-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

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
