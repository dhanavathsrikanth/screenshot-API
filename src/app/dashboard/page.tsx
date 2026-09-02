import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsageStats, getUserProfile, getScreenshotHistory } from "@/app/actions/usage";
import { getPeriodComparisons, getUsageAlerts } from "@/app/actions/analytics";
import { getUserPlan, checkRateLimit, getPlanLimits } from "@/lib/plans";
import { StatsCard, UsageBar } from "@/components/dashboard/stats-card";
import { PeriodComparison, UsageAlerts } from "@/components/dashboard/charts";
import { UpgradeButton } from "@/components/upgrade-button";
import { PlanUpsellBanner } from "@/components/dashboard/plan-upsell-banner";
import { DashboardLoadErrorBanner } from "@/components/dashboard/data-access-banner";
import { getPlanLabel } from "@/lib/plan-display";
import { DashboardLive } from "@/components/dashboard/dashboard-live";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type UserProfile = {
  id: string; email: string | null; first_name: string | null; last_name: string | null;
  image_url: string | null; created_at: string; username: string | null;
  profile_image_url: string | null; has_image: boolean | null; locale: string | null;
  external_accounts: { provider: string; email_address: string; first_name?: string; last_name?: string; avatar_url?: string }[] | null;
  password_enabled: boolean | null; two_factor_enabled: boolean | null;
  banned: boolean | null; locked: boolean | null;
  last_active_at: string | null; last_sign_in_at: string | null;
} | null;

type Stats = {
  plan: string;
  monthlyUsed: number; monthlyLimit: number;
  creditBalance: number; creditsUsedThisCycle: number; creditsGrantedThisCycle: number;
  topUpBalance: number; overageEnabled: boolean;
  cacheHitRate: number; totalCalls: number;
  quotaResetAt?: string | null;
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let stats: Stats;
  let profile: UserProfile;
  let periodComparison: { thisWeek: number; lastWeek: number; weekDelta: number; thisMonth: number; lastMonth: number; monthDelta: number };
  let alerts: { id: string; alert_type: string; threshold_pct: number; triggered_at: string; acknowledged: boolean }[];
  let recentRows: Awaited<ReturnType<typeof getScreenshotHistory>> = [];
  let rateLimit: { allowed: boolean; retryAfterMs: number; limit: number; remaining: number; reset: number } | null = null;
  let planLabel = "Free";
  let rateLimitDisplay: string | null = null;
  let loadError: string | null = null;

  try {
    const plan = await getUserPlan(userId);
    planLabel = getPlanLabel(plan);
    const [s, p, pc, a, history, rl] = await Promise.all([
      getUsageStats(userId),
      getUserProfile(userId),
      getPeriodComparisons(userId).catch(() => ({ thisWeek: 0, lastWeek: 0, weekDelta: 0, thisMonth: 0, lastMonth: 0, monthDelta: 0 })),
      getUsageAlerts(userId).catch(() => []),
      getScreenshotHistory(userId, { limit: 5 }).catch(() => [] as Awaited<ReturnType<typeof getScreenshotHistory>>),
      checkRateLimit(userId, plan as "free" | "starter" | "pro" | "scale").catch(() => null),
    ]);
    stats = s;
    profile = p;
    periodComparison = pc;
    alerts = a;
    recentRows = history;
    rateLimit = rl;
    if (rl) rateLimitDisplay = `${rl.remaining}/${rl.limit}`;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load dashboard data.";
    const empty: Stats = { plan: "free", monthlyUsed: 0, monthlyLimit: 100, creditBalance: 0, creditsUsedThisCycle: 0, creditsGrantedThisCycle: 0, topUpBalance: 0, overageEnabled: false, cacheHitRate: 0, totalCalls: 0 };
    stats = empty;
    profile = null;
    periodComparison = { thisWeek: 0, lastWeek: 0, weekDelta: 0, thisMonth: 0, lastMonth: 0, monthDelta: 0 };
    alerts = [];
    try { planLabel = getPlanLabel(stats.plan); } catch { planLabel = "Free"; }
  }

  const displayName = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email?.split("@")[0] : "there";
  const usagePct = stats.monthlyLimit > 0 ? Math.round((stats.monthlyUsed / stats.monthlyLimit) * 100) : 0;
  const isFree = stats.plan === "free";
  const isHighUsage = usagePct >= 80;
  const remaining = Math.max(stats.monthlyLimit - stats.monthlyUsed, 0);
  const creditsTotal = (stats.creditsGrantedThisCycle ?? 0) + (stats.topUpBalance ?? 0);
  const creditsPct = creditsTotal > 0 ? Math.round((stats.creditsUsedThisCycle / creditsTotal) * 100) : 0;
  const isCreditLow = stats.creditBalance <= 10 || creditsPct >= 85;
  const isRateLimited = rateLimit ? !rateLimit.allowed || rateLimit.remaining <= 0 : false;
  const limits = getPlanLimits((stats.plan as "free" | "starter" | "pro" | "scale") ?? "free");
  const resetAt = (stats as Stats & { quotaResetAt?: string | null }).quotaResetAt ? new Date((stats as Stats & { quotaResetAt?: string | null }).quotaResetAt!) : null;
  const daysUntilReset = resetAt ? Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / (24*60*60*1000))) : null;

  const quickActions = [
    {
      href: "/dashboard/playground",
      label: "Playground",
      desc: "Capture a live screenshot and copy code in one click",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/api-keys",
      label: "API Keys",
      desc: "Create and rotate keys — keep them private",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/history",
      label: "History",
      desc: "Browse recent captures and re-run requests",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      href: "/dashboard/analytics",
      label: "Analytics",
      desc: "Latency, cache hits and usage trends",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      ),
    },
  ];

  // Build a tiny usage snapshot for the live poller (derive from server stats)
  const usageForLive = {
    plan: stats.plan,
    entitlements: { rate_limit_per_minute: limits.rateLimitPerMinute },
    period: {
      start: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
      end: resetAt ? resetAt.toISOString() : new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      reset_at: resetAt ? resetAt.toISOString() : null,
    },
    requests: { used: stats.monthlyUsed, limit: stats.monthlyLimit, remaining },
    credits: {
      used_this_cycle: stats.creditsUsedThisCycle,
      granted_this_cycle: stats.creditsGrantedThisCycle,
      balance: stats.creditBalance,
      top_up_balance: stats.topUpBalance,
      overage_enabled: stats.overageEnabled,
    },
    requests_this_window: { total: stats.totalCalls, cached: Math.round(stats.totalCalls * stats.cacheHitRate / 100), cache_hit_rate: stats.cacheHitRate },
  };

  const liveRate = rateLimit ? { ...rateLimit } : null;

  return (
    <>
      {loadError && <DashboardLoadErrorBanner message={loadError} />}

      {/* Page header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">
                <span className={`h-1.5 w-1.5 rounded-full ${isFree ? "bg-[var(--dim)]" : "bg-emerald-500"}`} />
                {planLabel} workspace · {limits.rateLimitPerMinute}/min
              </span>
              {rateLimit && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isRateLimited ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isRateLimited ? "bg-red-500" : "bg-emerald-500"}`} />
                  {isRateLimited ? "Rate limited" : `${rateLimitDisplay} left`}
                </span>
              )}
              {profile?.email && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-2.5 py-1 text-xs text-[var(--dim)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15A2.25 2.25 0 0 0 2.25 6.75m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>
                  {profile.email}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.03em] text-[var(--ink)] sm:text-[32px]">
              Welcome back, <span className="underline decoration-[var(--line)] decoration-2 underline-offset-4">{displayName}</span>
            </h1>
            <p className="mt-2 max-w-[70ch] text-sm leading-6 text-[var(--dim)]">
              {isFree
                ? "Free includes viewport PNG, JPEG and WebP. Upgrade to Starter for full-page captures, PDFs, 2,500 screenshots/mo and 30-day history."
                : `Monitor usage, credits and rate limits — all live. ${planLabel} gives you ${limits.monthlyScreenshots.toLocaleString()} screenshots/mo and ${limits.rateLimitPerMinute}/min.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isFree ? <UpgradeButton /> : stats.plan !== "scale" && <UpgradeButton variant="secondary" />}
            <Link
              href="/dashboard/playground"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 dark:bg-white dark:text-black"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              Open Playground
            </Link>
          </div>
        </div>

        <div className="h-px bg-[var(--border)]" />
      </div>

      {isFree && <PlanUpsellBanner plan="free" />}

      <UsageAlerts data={alerts} />

      {/* Live credits + ratelimit — polling /api/v1/usage + history + /api/v1/screenshots */}
      <DashboardLive initialUsage={usageForLive as never} initialRateLimit={liveRate as never} userId={userId} />

      {/* Fallback static snapshot when JS disabled — also visible immediately */}
      <noscript>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Live sync requires JavaScript — showing snapshot below.</div>
      </noscript>

      {/* Credits consumed breakdown (static, mirrors live) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Credits — consumed this cycle</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">{stats.creditsUsedThisCycle.toLocaleString()}</span>
                <span className="text-sm text-[var(--dim)]">used</span>
                <span className="text-sm text-[var(--dim)]">/ {stats.creditsGrantedThisCycle.toLocaleString()} granted</span>
                {stats.topUpBalance > 0 && <span className="text-sm text-[var(--dim)]">+ {stats.topUpBalance.toLocaleString()} top-up</span>}
                <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${isCreditLow ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800" : "bg-[var(--muted)] text-[var(--dim)] ring-[var(--border)]"}`}>
                  {creditsPct}% used
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--dim)]">
                Balance: <b className="text-[var(--ink)]">{stats.creditBalance.toLocaleString()}</b> · Remaining: <b className="text-[var(--ink)]">{Math.max(0, creditsTotal - stats.creditsUsedThisCycle).toLocaleString()}</b>
                {stats.overageEnabled ? " · overage enabled" : " · no overage"}
                {daysUntilReset !== null ? ` · resets in ${daysUntilReset}d` : ""}
              </p>
            </div>
            <div className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-xl ${isCreditLow ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-[var(--muted)] text-[var(--dim)]"}`}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            </div>
          </div>
          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--line)] dark:bg-[var(--muted)]">
              <div className={`h-full rounded-full transition-all duration-500 ${isCreditLow ? "bg-amber-500" : "bg-[var(--ink)]"}`} style={{ width: `${Math.min(100, creditsPct)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[var(--dim)]">
              <span>0</span>
              <span>{creditsTotal.toLocaleString()} total</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-[var(--dim)] hover:text-[var(--ink)]">
              View analytics <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </Link>
            <span className="text-[var(--line)]">•</span>
            <Link href="/dashboard/plan" className="inline-flex items-center gap-1 text-[var(--dim)] hover:text-[var(--ink)]">Manage plan</Link>
            <span className="text-[var(--line)]">•</span>
            <Link href="/dashboard/billing" className="inline-flex items-center gap-1 text-[var(--dim)] hover:text-[var(--ink)]">Billing</Link>
          </div>
        </div>

        <div className="card p-6 flex flex-col">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Rate limit — live</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-semibold tracking-tight tabular-nums ${isRateLimited ? "text-red-600 dark:text-red-400" : "text-[var(--ink)]"}`}>
              {rateLimit ? rateLimit.remaining : "—"}
            </span>
            <span className="text-sm text-[var(--dim)]">/ {limits.rateLimitPerMinute} /min left</span>
          </div>
          {rateLimit ? (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--line)] dark:bg-[var(--muted)]">
                <div className={`h-full rounded-full ${isRateLimited ? "bg-red-500" : rateLimit.remaining < limits.rateLimitPerMinute * 0.2 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(0, Math.min(100, (rateLimit.remaining / limits.rateLimitPerMinute) * 100))}%` }} />
              </div>
              <p className="mt-2 text-xs text-[var(--dim)]">
                {isRateLimited
                  ? `Limited — retry in ${Math.ceil(rateLimit.retryAfterMs / 1000)}s · resets ${new Date(rateLimit.reset).toLocaleTimeString()}`
                  : `Resets in ${Math.max(0, Math.ceil((rateLimit.reset - Date.now())/1000))}s · ${new Date(rateLimit.reset).toLocaleTimeString()}`}
              </p>
              <p className="mt-3 rounded-lg bg-[var(--muted)]/60 px-3 py-2 text-[11px] leading-relaxed text-[var(--dim)]">
                Plan <b className="text-[var(--ink)]">{planLabel}</b> · {limits.rateLimitPerMinute} req/min · {stats.totalCalls.toLocaleString()} calls (30d) · cache {stats.cacheHitRate}%
              </p>
            </>
          ) : (
            <p className="mt-3 text-xs text-[var(--dim)]">Rate info loads after your first request via Playground or <code className="rounded bg-[var(--muted)] px-1">/api/v1/screenshots</code>.</p>
          )}
          <div className="mt-auto pt-4 flex gap-2">
            <Link href="/dashboard/playground" className="inline-flex flex-1 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium hover:bg-[var(--muted)]">Test in Playground</Link>
            <Link href="/docs" className="inline-flex items-center justify-center rounded-full bg-[var(--muted)] px-3 py-2 text-xs font-medium hover:bg-[var(--border)]">Docs</Link>
          </div>
        </div>
      </section>

      {/* Usage overview — monthly requests */}
      <section className="card overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Monthly usage — requests</p>
                <div className="mt-2 flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight text-[var(--ink)] tabular-nums">{stats.monthlyUsed.toLocaleString()}</span>
                  <span className="text-sm text-[var(--dim)]">/ {stats.monthlyLimit.toLocaleString()} screenshots</span>
                  <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${isHighUsage ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800" : "bg-[var(--muted)] text-[var(--dim)] ring-[var(--border)]"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${isHighUsage ? "bg-amber-500" : "bg-emerald-500"}`} />
                    {usagePct}% used
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--dim)]">{remaining.toLocaleString()} remaining this cycle · {stats.totalCalls.toLocaleString()} total (30d)</p>
              </div>
              <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--muted)] text-[var(--dim)]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </div>
            </div>
            <div className="mt-6">
              <UsageBar used={stats.monthlyUsed} limit={stats.monthlyLimit} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Link href="/dashboard/analytics" className="inline-flex items-center gap-1 text-[var(--dim)] hover:text-[var(--ink)]">
                View analytics
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              </Link>
              <span className="text-[var(--line)]">•</span>
              <Link href="/dashboard/plan" className="inline-flex items-center gap-1 text-[var(--dim)] hover:text-[var(--ink)]">Manage plan</Link>
              <span className="text-[var(--line)]">•</span>
              <Link href="/dashboard/history" className="inline-flex items-center gap-1 text-[var(--dim)] hover:text-[var(--ink)]">History ({recentRows.length} recent)</Link>
            </div>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--muted)]/40 p-6 sm:p-7 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">At a glance — from API + History</p>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5">
                <dt className="text-xs text-[var(--dim)]">Credits left</dt>
                <dd className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{stats.creditBalance.toLocaleString()}</dd>
                <dd className="text-[11px] text-[var(--dim)]">{stats.creditsUsedThisCycle.toLocaleString()} used · {stats.creditsGrantedThisCycle.toLocaleString()} granted</dd>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5">
                <dt className="text-xs text-[var(--dim)]">Cache hit</dt>
                <dd className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{stats.cacheHitRate}%</dd>
                <dd className="text-[11px] text-[var(--dim)]">{stats.cacheHitRate >= 50 ? "Great efficiency" : "Warming up"}</dd>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5">
                <dt className="text-xs text-[var(--dim)]">API calls (30d)</dt>
                <dd className="mt-1 text-lg font-semibold tracking-tight tabular-nums">{stats.totalCalls.toLocaleString()}</dd>
                <dd className="text-[11px] text-[var(--dim)]">Total requests</dd>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5">
                <dt className="text-xs text-[var(--dim)]">Plan</dt>
                <dd className="mt-1 text-lg font-semibold tracking-tight">{planLabel}</dd>
                <dd className="text-[11px] text-[var(--dim)]">{stats.overageEnabled ? "Overage enabled" : "No overage"} · {limits.rateLimitPerMinute}/min</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Recent history preview — pulls from same source as /dashboard/history */}
      {recentRows.length > 0 ? (
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Recent captures — from History</h2>
            <Link href="/dashboard/history" className="text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)]">View all →</Link>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentRows.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                href="/dashboard/history"
                className="group flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 hover:border-[var(--card-hover-border)] hover:shadow-[var(--card-hover-shadow)] transition"
              >
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--muted)] flex items-center justify-center text-[10px] text-[var(--dim)]">
                  {r.storage_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    // @ts-ignore
                    <img src={r.storage_url} alt={r.url} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span>{r.format.toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{r.url}</p>
                  <p className="text-[11px] text-[var(--dim)]">{r.format.toUpperCase()} · {r.width}×{r.height} · {new Date(r.created_at).toLocaleDateString()}</p>
                  <p className="text-[11px] text-[var(--dim)]">{r.cached ? "cached" : "fresh"} · {(r.file_size_bytes ? `${(r.file_size_bytes/1024).toFixed(1)} KB` : "")}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="card border-dashed p-6 text-center">
          <p className="text-sm font-medium">No captures yet</p>
          <p className="mt-1 text-xs text-[var(--dim)]">Try the Playground or call <code className="rounded bg-[var(--muted)] px-1">POST /api/take</code> / <code className="rounded bg-[var(--muted)] px-1">POST /api/v1/screenshots</code> — history appears here instantly.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Link href="/dashboard/playground" className="rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-medium text-white dark:bg-white dark:text-black">Open Playground</Link>
            <Link href="/docs" className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-medium hover:bg-[var(--muted)]">Read Docs</Link>
          </div>
        </section>
      )}

      {/* Rate limited warning — after overcall */}
      {isRateLimited && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-900 dark:text-red-200">Rate limited — {limits.rateLimitPerMinute}/min exceeded</p>
            <p className="text-xs text-red-700 dark:text-red-400">Retry in {rateLimit ? Math.ceil(rateLimit.retryAfterMs/1000) : 60}s · Playground and <code className="rounded bg-white px-1">/api/v1/screenshots</code> share the same window.</p>
          </div>
          <Link href="/dashboard/plan" className="hidden sm:inline-flex rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">Raise limit →</Link>
        </div>
      )}

      {/* Starter upgrade callout */}
      {isFree && (
        <div className="relative overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-violet-50 p-6 dark:border-orange-900/40 dark:from-orange-950/20 dark:via-[var(--card)] dark:to-violet-950/20">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-orange-500/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink)]">Unlock full-page captures and PDFs</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--dim)]">Starter gives you 2,500 screenshots/mo, full-page & PDF export, and 30-day history — $9/month.</p>
              </div>
            </div>
            <UpgradeButton className="shrink-0 rounded-full" />
          </div>
        </div>
      )}

      {/* High usage warning */}
      {isHighUsage && !isFree && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">You&apos;ve used {usagePct}% of your {planLabel} quota</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">{remaining.toLocaleString()} left this month — consider upgrading.</p>
          </div>
          <UpgradeButton className="hidden sm:inline-flex" />
        </div>
      )}

      {/* Low credits warning */}
      {isCreditLow && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white">◐</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Low credits — {stats.creditBalance.toLocaleString()} left ({creditsPct}% used)</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">{creditsTotal - stats.creditsUsedThisCycle <= 20 ? "You may be blocked on next capture — top up or enable overage." : "Top up soon to avoid failed captures."} · <Link href="/dashboard/billing" className="underline">Billing</Link></p>
          </div>
          <Link href="/dashboard/plan" className="hidden sm:inline-flex rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">Buy credits →</Link>
        </div>
      )}

      {/* Stats grid — refreshed */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Overview metrics — live</h2>
          <Link href="/dashboard/analytics" className="text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)]">Analytics →</Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Screenshots This Month"
            value={stats.monthlyUsed.toLocaleString()}
            sublabel={`${stats.monthlyLimit.toLocaleString()} monthly limit · ${remaining.toLocaleString()} left`}
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
            sublabel={`${stats.creditsUsedThisCycle.toLocaleString()} used · ${stats.creditsGrantedThisCycle.toLocaleString()} granted this cycle`}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
              </svg>
            }
          />
          <StatsCard
            label="Total API Calls"
            value={stats.totalCalls.toLocaleString()}
            sublabel={`Last 30 days · ${rateLimit ? `${rateLimit.limit}/min limit` : `${limits.rateLimitPerMinute}/min plan`}`}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            }
          />
          <StatsCard
            label="Cache Hit Rate"
            value={`${stats.cacheHitRate}%`}
            sublabel={stats.cacheHitRate >= 50 ? "Great efficiency" : "Warming up — repeats are free-ish"}
            icon={
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.81 15.312a4.5 4.5 0 0 1-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Middle section: Usage comparison (2/3) + Quick actions (1/3) — refreshed cards */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Trends — live from API logs</h2>
            <span className="text-xs text-[var(--dim)]">Week & month comparison</span>
          </div>
          <PeriodComparison data={periodComparison} />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Quick actions</h2>
          <div className="grid grid-cols-1 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--card-hover-border)] hover:shadow-[var(--card-hover-shadow)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--muted)] text-[var(--ink)] group-hover:bg-[var(--ink)] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-none text-[var(--foreground)]">{action.label}</p>
                  <p className="mt-1 line-clamp-1 text-xs leading-4 text-[var(--dim)]">{action.desc}</p>
                </div>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--dim)] group-hover:border-[var(--ink)] group-hover:text-[var(--ink)] transition">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </span>
              </Link>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/40 p-4">
            <p className="text-xs font-medium text-[var(--ink)]">Need help?</p>
            <p className="mt-1 text-xs leading-5 text-[var(--dim)]">Read the quick start or check the API docs. Playground and <code className="rounded bg-white px-1">POST /api/take</code> share auth & credits.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/dashboard/quickstart" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]">
                Quick start
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </Link>
              <Link href="/docs" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)]">Docs</Link>
              <Link href="/dashboard/history" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)]">History</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
