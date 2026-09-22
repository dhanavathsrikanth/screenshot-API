import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsageStats, getUserProfile, getScreenshotHistory } from "@/app/actions/usage";
import { getUserPlan, checkRateLimit } from "@/lib/plans";
import { UpgradeButton } from "@/components/upgrade-button";
import { PlanUpsellBanner } from "@/components/dashboard/plan-upsell-banner";
import { DashboardLoadErrorBanner } from "@/components/dashboard/data-access-banner";
import { getPlanLabel } from "@/lib/plan-display";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Stats = {
  plan: string;
  monthlyUsed: number;
  monthlyLimit: number;
  creditBalance: number;
  creditsUsedThisCycle: number;
  totalCalls: number;
  cacheHitRate: number;
};

const EMPTY_STATS: Stats = { plan: "free", monthlyUsed: 0, monthlyLimit: 100, creditBalance: 0, creditsUsedThisCycle: 0, totalCalls: 0, cacheHitRate: 0 };

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let stats = EMPTY_STATS;
  let profile: Awaited<ReturnType<typeof getUserProfile>> = null;
  let recentRows: Awaited<ReturnType<typeof getScreenshotHistory>> = [];
  let rateLimit: Awaited<ReturnType<typeof checkRateLimit>> | null = null;
  let loadError: string | null = null;

  try {
    const plan = await getUserPlan(userId);
    const [usage, userProfile, history, limits] = await Promise.all([
      getUsageStats(userId),
      getUserProfile(userId),
      getScreenshotHistory(userId, { limit: 4 }).catch(() => [] as Awaited<ReturnType<typeof getScreenshotHistory>>),
      checkRateLimit(userId, plan).catch(() => null),
    ]);
    stats = usage;
    profile = userProfile;
    recentRows = history;
    rateLimit = limits;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Failed to load dashboard data.";
  }

  const planLabel = getPlanLabel(stats.plan);
  const displayName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email?.split("@")[0] || "there" : "there";
  const remaining = Math.max(stats.monthlyLimit - stats.monthlyUsed, 0);
  const isFree = stats.plan === "free";
  const rateLimited = Boolean(rateLimit && (!rateLimit.allowed || rateLimit.remaining <= 0));

  return (
    <div className="space-y-6">
      {loadError && <DashboardLoadErrorBanner message={loadError} />}
      <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{planLabel} workspace</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--ink)] sm:text-3xl">Welcome back, {displayName}</h1>
          <p className="mt-1.5 text-sm text-[var(--dim)]">Capture, monitor, and ship without the noise.</p>
        </div>
        <div className="flex items-center gap-2">
          {isFree && <UpgradeButton />}
          <Link href="/dashboard/playground" className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--ink)] px-4 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black">Open playground</Link>
        </div>
      </header>

      {isFree && <PlanUpsellBanner plan="free" />}

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/dashboard/analytics" className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--card-hover-border)] hover:shadow-sm"><p className="text-xs text-[var(--dim)]">Screenshots this month</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-[var(--ink)]">{stats.monthlyUsed.toLocaleString()}</p><p className="mt-1 text-[11px] text-[var(--dim)]">of {stats.monthlyLimit.toLocaleString()} · {remaining.toLocaleString()} left</p></Link>
        <Link href="/dashboard/billing" className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--card-hover-border)] hover:shadow-sm"><p className="text-xs text-[var(--dim)]">Credits remaining</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-[var(--ink)]">{stats.creditBalance.toLocaleString()}</p><p className="mt-1 text-[11px] text-[var(--dim)]">{stats.creditsUsedThisCycle.toLocaleString()} used this cycle</p></Link>
        <Link href="/dashboard/analytics" className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--card-hover-border)] hover:shadow-sm"><p className="text-xs text-[var(--dim)]">API calls · 30 days</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-[var(--ink)]">{stats.totalCalls.toLocaleString()}</p><p className="mt-1 text-[11px] text-[var(--dim)]">{stats.cacheHitRate}% cache hit rate</p></Link>
      </section>

      {rateLimited && rateLimit && <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300"><span>Rate limited · retry in {Math.ceil(rateLimit.retryAfterMs / 1000)}s</span><Link href="/dashboard/plan" className="font-medium underline">Raise limit</Link></div>}

      <section className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-[var(--ink)]">Recent captures</h2><p className="mt-0.5 text-xs text-[var(--dim)]">Your latest output</p></div><Link href="/dashboard/history" className="text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)]">View all</Link></div>
          {recentRows.length > 0 ? <div className="mt-4 divide-y divide-[var(--border)]">{recentRows.map((row) => <Link key={row.id} href="/dashboard/history" className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><div className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--muted)]">{row.storage_url ? <img src={row.storage_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full items-center justify-center text-[10px] text-[var(--dim)]">{row.format.toUpperCase()}</span>}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-[var(--ink)]">{row.url ?? "Generated capture"}</p><p className="mt-0.5 text-[11px] text-[var(--dim)]">{row.format.toUpperCase()} · {row.width}×{row.height}</p></div><span className="text-[11px] text-[var(--dim)]">{new Date(row.created_at).toLocaleDateString()}</span></Link>)}</div> : <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] px-4 py-8 text-center"><p className="text-sm font-medium text-[var(--ink)]">No captures yet</p><Link href="/dashboard/playground" className="mt-2 inline-flex text-xs font-medium text-[var(--accent)] hover:underline">Create your first capture</Link></div>}
        </div>
        <aside className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5"><h2 className="text-sm font-semibold text-[var(--ink)]">Shortcuts</h2><div className="mt-3 space-y-1"><Link href="/dashboard/api-keys" className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--dim)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"><span>API keys</span><span>→</span></Link><Link href="/dashboard/projects" className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--dim)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"><span>Projects</span><span>→</span></Link><Link href="/dashboard/quickstart" className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs text-[var(--dim)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"><span>Quick start</span><span>→</span></Link></div></aside>
      </section>
    </div>
  );
}
