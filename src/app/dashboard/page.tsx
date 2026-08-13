import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsageStats, getUserProfile } from "@/app/actions/usage";
import { getPeriodComparisons, getUsageAlerts } from "@/app/actions/analytics";
import { StatsCard, UsageBar } from "@/components/dashboard/stats-card";
import { PeriodComparison, UsageAlerts } from "@/components/dashboard/charts";
import { UpgradeButton } from "@/components/upgrade-button";
import { PageHeader } from "@/components/dashboard/page-header";

type UserProfile = {
  id: string; email: string | null; first_name: string | null; last_name: string | null;
  image_url: string | null; created_at: string; username: string | null;
  profile_image_url: string | null; has_image: boolean | null; locale: string | null;
  external_accounts: { provider: string; email_address: string; first_name?: string; last_name?: string; avatar_url?: string }[] | null;
  password_enabled: boolean | null; two_factor_enabled: boolean | null;
  banned: boolean | null; locked: boolean | null;
  last_active_at: string | null; last_sign_in_at: string | null;
} | null;
type Stats = { plan: string; monthlyUsed: number; monthlyLimit: number; creditBalance: number; creditsUsedThisCycle: number; creditsGrantedThisCycle: number; topUpBalance: number; overageEnabled: boolean; cacheHitRate: number; totalCalls: number };

const planLabels: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro" };

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let stats: Stats; let profile: UserProfile; let periodComparison: any; let alerts: any[];

  try {
    [stats, profile, periodComparison, alerts] = await Promise.all([
      getUsageStats(userId), getUserProfile(userId), getPeriodComparisons(userId),
      getUsageAlerts(userId),
    ]);
  } catch {
    const empty = { plan: "free", monthlyUsed: 0, monthlyLimit: 100, creditBalance: 0, creditsUsedThisCycle: 0, creditsGrantedThisCycle: 0, topUpBalance: 0, overageEnabled: false, cacheHitRate: 0, totalCalls: 0 };
    stats = empty; profile = null;
    periodComparison = { thisWeek: 0, lastWeek: 0, weekDelta: 0, thisMonth: 0, lastMonth: 0, monthDelta: 0 };
    alerts = [];
  }

  const displayName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email : "User";
  const usagePct = stats.monthlyLimit > 0 ? Math.round((stats.monthlyUsed / stats.monthlyLimit) * 100) : 0;
  const isFree = stats.plan === "free";
  const isHighUsage = usagePct >= 80;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome back, ${displayName}`}
        description={profile?.email ?? "Your API at a glance"}
        actions={
          <>
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              isFree
                ? "bg-zinc-100 text-zinc-600"
                : "bg-indigo-100 text-indigo-700"
            }`}>
              {planLabels[stats.plan] ?? stats.plan} Plan
            </span>
            {isFree && <UpgradeButton />}
            {!isFree && stats.plan === "starter" && <UpgradeButton variant="secondary" />}
          </>
        }
      />

      {/* Upgrade Banner for Free Users */}
      {isFree && (
        <div className="card card-lift border-indigo-500/30 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/20 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex-shrink-0">
                <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Unlock the full power of ScreenshotAPI</h3>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                  Upgrade to Starter for 2,500 screenshots/mo at just $9. That&apos;s 25x more than your free plan.
                </p>
              </div>
            </div>
            <UpgradeButton className="whitespace-nowrap" />
          </div>
        </div>
      )}

      {/* High Usage Warning */}
      {isHighUsage && !isFree && (
        <div className="card card-lift border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                You&apos;ve used {usagePct}% of your {planLabels[stats.plan]} plan
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {stats.monthlyLimit - stats.monthlyUsed} screenshots remaining this month
              </p>
            </div>
            <UpgradeButton className="whitespace-nowrap" />
          </div>
        </div>
      )}

      <UsageAlerts data={alerts} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <StatsCard label="Screenshots This Month" value={stats.monthlyUsed.toLocaleString()} sublabel={`${stats.monthlyLimit.toLocaleString()} monthly limit`} icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>
          } accent />
          <div className="px-6 pt-1"><UsageBar used={stats.monthlyUsed} limit={stats.monthlyLimit} /></div>
        </div>
        <StatsCard label="Credits Remaining" value={stats.creditBalance.toLocaleString()} sublabel={`${stats.creditsGrantedThisCycle.toLocaleString()} granted this cycle`} icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
        } />
        <StatsCard label="Credits Used This Cycle" value={stats.creditsUsedThisCycle.toLocaleString()} sublabel={stats.topUpBalance > 0 ? `+${stats.topUpBalance.toLocaleString()} top-up balance` : undefined} icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
        } />
        <StatsCard label="Total API Calls" value={stats.totalCalls.toLocaleString()} sublabel="Last 30 days" icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>
        } />
        <StatsCard label="Cache Hit Rate" value={`${stats.cacheHitRate}%`} sublabel={stats.cacheHitRate >= 50 ? "Great efficiency" : "Warming up"} icon={
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
        } />
      </div>

      {/* Middle section: Usage comparison (2/3) + Quick Actions (1/3) */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PeriodComparison data={periodComparison} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="eyebrow text-zinc-400">Quick Actions</h2>
          {[
            { href: "/dashboard/analytics", label: "Analytics", sub: "Usage trends and performance", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /> },
            { href: "/dashboard/tracking", label: "API Tracking", sub: "Request logs and breakdowns", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.788m13.788 0c3.808 3.808 3.808 9.98 0 13.788M12 12h.008v.007H12V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /> },
            { href: "/dashboard/quickstart", label: "Quick Start", sub: "Code snippets to get started", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /> },
            { href: "/dashboard/playground", label: "Playground", sub: "Try the screenshot API live", icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></> },
            { href: "/dashboard/api-keys", label: "API Keys", sub: "Manage your API keys", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" /> },
            { href: "/dashboard/history", label: "History", sub: "View recent screenshots", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /> },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="card card-lift flex items-center gap-3 p-4 group"
            >
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">{action.icon}</svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{action.label}</p>
                <p className="text-xs text-zinc-500">{action.sub}</p>
              </div>
              <svg className="h-4 w-4 text-zinc-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
