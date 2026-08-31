import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserPlan } from "@/lib/plans";
import { DashboardPlayground } from "@/components/dashboard/dashboard-playground";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function PlaygroundPage() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    redirect("/sign-in");
  }
  if (!userId) redirect("/sign-in");

  const plan = await getUserPlan(userId);

  return (
    <>
      <PageHeader
        eyebrow="Playground"
        title="Try the Screenshot API"
        description="Test the same API your app calls. Free covers viewport captures — Starter ($9) unlocks full-page and PDF."
      />
      <DashboardPlayground plan={plan} showUpsell />
    </>
  );
}
