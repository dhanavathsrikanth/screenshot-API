import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardPlayground } from "@/components/dashboard/dashboard-playground";

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
      <div>
        <h1 className="text-2xl font-bold">Playground</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Render screenshots directly from the dashboard.
        </p>
      </div>
      <DashboardPlayground />
    </div>
  );
}
