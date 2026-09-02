import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserPlan } from "@/lib/plans";
import { DashboardPlayground } from "@/components/dashboard/dashboard-playground";

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">Playground</h1>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Send a live <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-xs">POST</code> request — same API your app calls. No sample data, no mocks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/docs" className="inline-flex h-8 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium hover:bg-[var(--muted)]">
            Docs
          </a>
          <a href="/dashboard/api-keys" className="inline-flex h-8 items-center rounded-md border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium hover:bg-[var(--muted)]">
            API keys
          </a>
        </div>
      </div>
      <DashboardPlayground plan={plan} showUpsell={false} />
    </div>
  );
}
