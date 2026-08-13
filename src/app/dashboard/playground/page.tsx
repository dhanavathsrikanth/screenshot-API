import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardPlayground } from "@/components/dashboard/dashboard-playground";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function PlaygroundPage() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    redirect("/");
  }
  if (!userId) redirect("/");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Playground"
        title="Try the Screenshot API"
        description="Render screenshots directly from the dashboard."
      />
      <DashboardPlayground />
    </div>
  );
}
