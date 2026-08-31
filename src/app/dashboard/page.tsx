import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsageStats, getUserProfile } from "@/app/actions/usage";
import { getPeriodComparisons, getUsageAlerts } from "@/app/actions/analytics";
import { StatsCard, UsageBar } from "@/components/dashboard/stats-card";
import { PeriodComparison, UsageAlerts } from "@/components/dashboard/charts";
import { UpgradeButton } from "@/components/upgrade-button";
import { PlanUpsellBanner } from "@/components/dashboard/plan-upsell-banner";
import { DashboardLoadErrorBanner } from "@/components/dashboard/data-access-banner";
import { getPlanLabel } from "@/lib/plan-display";

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

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let stats: Stats; let profile: UserProfile;
  let periodComparison: { thisWeek: number; lastWeek: number; weekDelta: number; thisMonth: number; lastMonth: number; monthDelta: number };
  let alerts: { id: string; alert_type: string; threshold_pct: number; triggered_at: string; acknowledged: boolean }[];
  let loadError: string | null = null;

  try {
    [stats, profile, periodComparison, alerts] = await Promise.all([
      getUsageStats(userId), getUserProfile(userId), getPeriodComparisons(userId),
      getUsageAlerts(userId),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load dashboard data.";
    const empty = { plan: "free", monthlyUsed: 0, monthlyLimit: 100, creditBalance: 0, creditsUsedThisCycle: 0, creditsGrantedThisCycle: 0, topUpBalance: 0, overageEnabled: false, cacheHitRate: 0, totalCalls: 0 };
    stats = empty; profile = null;
    periodComparison = { thisWeek: 0, lastWeek: 0, weekDelta: 0, thisMonth: 0, lastMonth: 0, monthDelta: 0 };
    alerts = [];
  }

  const displayName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email : "User";
  const usagePct = stats.monthlyLimit > 0 ? Math.round((stats.monthlyUsed / stats.monthlyLimit) * 100) : 0;
  const isFree = stats.plan === "free";
  const isHighUsage = usagePct >= 80;
  const remaining = Math.max(stats.monthlyLimit - stats.monthlyUsed, 0);

  const quickActions = [
    {
      href: "/dashboard/playground",
      label: "Playground",
      sub: "Try the screenshot API live",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/api-keys",
      label: "API Keys",
      sub: "Create & manage API keys",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/history",
      label: "History",
      sub: "View recent screenshots",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/analytics",
      label: "Analytics",
      sub: "Usage, reliability & cost",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/plan",
      label: "Plan & Billing",
      sub: "Credits, invoices & upgrade",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7.5h6M9 10.5h6M8.25 3.75h7.5A2.25 2.25 0 0 1 18 6v12.75l-3-1.5-3 1.5-3-1.5-3 1.5V6a2.25 2.25 0 0 1 2.25-2.25Z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {loadError && <DashboardLoadErrorBanner message={loadError} />}
      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #f97316 0%, transparent 70%)" }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                  isFree
                    ? "bg-[var(--muted)] text-[var(--dim)]"
                    : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                }`}
              >
                {isFree && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                  </span>
                )}
                {getPlanLabel(stats.plan)} Plan
              </span>
              <span className="hidden sm:inline text-xs text-[var(--dim)]">{profile?.email}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-[var(--ink)]">
              Welcome back, <span className="text-[var(--accent)]">{displayName}</span>
            </h1>
            <p className="mt-1.5 max-w-xl text-pretty leading-[1.6] text-[var(--dim)]">
              {isFree
                ? "Free covers viewport PNG, JPEG, and WebP. Starter ($9) adds full-page, PDF, 2,500 captures, and 30-day history."
                : "Track your screenshots, credits, and API health in one place."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {isFree && <UpgradeButton />}
            {!isFree && stats.plan !== "scale" && <UpgradeButton variant="secondary" />}
            <Link
              href="/dashboard/playground"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--muted)]"
            >
              <svg className="h-4 w-4 text-[var(--dim)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
              </svg>
              Open Playground
            </Link>
          </div>
        </div>
      </div>

      {isFree && <PlanUpsellBanner plan="free" />}

      {/* Usage meter */}
      <div className="card card-lift p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-title">Monthly Usage</p>
            <p className="mt-1 text-sm text-[var(--dim)]">
              <span className="metric-value text-[var(--foreground)]">
                {stats.monthlyUsed.toLocaleString()}
              </span>
              <span className="mx-1.5 text-[var(--line)]">/</span>
              {stats.monthlyLimit.toLocaleString()} screenshots
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                isHighUsage
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-[var(--muted)] text-[var(--dim)]"
              }`}
            >
              {usagePct}% used
            </span>
            <span className="text-[var(--dim)]">{remaining.toLocaleString()} remaining</span>
          </div>
        </div>
        <div className="mt-3">
          <UsageBar used={stats.monthlyUsed} limit={stats.monthlyLimit} />
        </div>
      </div>

      {/* Upgrade banner (free users) */}
      {isFree && (
        <div className="card card-lift border-orange-500/30 bg-gradient-to-r from-orange-50 to-purple-50 p-5 dark:from-orange-950/30 dark:to-purple-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-200">Starter unlocks what products actually need</h3>
                <p className="mt-0.5 text-xs text-orange-700 dark:text-orange-300">
                  Full-page captures, PDF export, 2,500 screenshots/mo, and 30-day history — $9/month.
                </p>
              </div>
            </div>
            <UpgradeButton className="whitespace-nowrap" />
          </div>
        </div>
      )}

      {/* High Usage Warning */}
      {isHighUsage && !isFree && (
        <div className="card card-lift border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                You&apos;ve used {usagePct}% of your {getPlanLabel(stats.plan)} plan
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {remaining.toLocaleString()} screenshots remaining this month
              </p>
            </div>
            <UpgradeButton className="whitespace-nowrap" />
          </div>
        </div>
      )}

      <UsageAlerts data={alerts} />

      {/* Stats grid */}
      <section>
        <h2 className="section-title mb-4">Account Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Screenshots This Month"
            value={stats.monthlyUsed.toLocaleString()}
            sublabel={`${stats.monthlyLimit.toLocaleString()} monthly limit`}
            accent
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
            }
          />
          <StatsCard
            label="Credits Remaining"
            value={stats.creditBalance.toLocaleString()}
            sublabel={`${stats.creditsGrantedThisCycle.toLocaleString()} granted this cycle`}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            }
          />
          <StatsCard
            label="Total API Calls"
            value={stats.totalCalls.toLocaleString()}
            sublabel="Last 30 days"
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            }
          />
          <StatsCard
            label="Cache Hit Rate"
            value={`${stats.cacheHitRate}%`}
            sublabel={stats.cacheHitRate >= 50 ? "Great efficiency" : "Warming up"}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Middle section: Usage comparison (2/3) + Quick actions (1/3) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PeriodComparison data={periodComparison} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="section-title">Quick Actions</h2>
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="card card-lift group flex items-center gap-3 p-4"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 transition-transform group-hover:scale-105 dark:bg-orange-900/40 dark:text-orange-400">
                {action.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--foreground)] transition-colors group-hover:text-orange-600 dark:group-hover:text-orange-400">
                  {action.label}
                </p>
                <p className="text-xs text-[var(--dim)]">{action.sub}</p>
              </div>
              <svg
                className="h-4 w-4 flex-shrink-0 text-[var(--line)] transition-colors group-hover:text-orange-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
