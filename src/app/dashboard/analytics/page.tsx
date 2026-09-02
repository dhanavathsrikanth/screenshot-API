import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import {
  getDailyUsage,
  getLatencyStats,
  getPeakHours,
  getUsageForecast,
  getBandwidthStats,
  getCostEstimation,
  getEndpointBreakdown,
  getFormatDistribution,
  getStatusBreakdown,
  getCacheTrend,
  getKeyUsageStats,
  getSLAStats,
  getPeriodComparisons,
  getMethodBreakdown,
} from "@/app/actions/analytics";
import { getUsageStats } from "@/app/actions/usage";
import { getUserPlan, checkRateLimit } from "@/lib/plans";
import { getPlanLabel } from "@/lib/plan-display";
import {
  UsageChart,
  LatencyChart,
  PeakHoursHeatmap,
  UsageForecast,
  BandwidthChart,
  CostEstimation,
  EndpointPie,
  FormatPie,
  StatusPie,
  CacheTrendChart,
  KeyHealthTable,
  SLAMonitor,
  PeriodComparison,
} from "@/components/dashboard/charts";
import { AnalyticsControls, AnalyticsActionBar } from "@/components/dashboard/analytics-controls";
import { AnalyticsLiveRefresh } from "@/components/dashboard/analytics-live-refresh";
import { AnalyticsCreditStrip } from "@/components/dashboard/analytics-credit-strip";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Sla = Awaited<ReturnType<typeof getSLAStats>>;

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="section-title">{label}</p>
      <p className="metric-value mt-1" style={{ color: tone ?? "var(--ink)" }}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--dim)]">{hint}</p>
    </div>
  );
}

function Section({
  index,
  title,
  description,
  actions,
  children,
  gridClass = "grid grid-cols-1 lg:grid-cols-2 gap-4",
}: {
  index: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  gridClass?: string;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
        <div className="flex items-baseline gap-3">
          <span className="section-title text-[var(--accent)] tabular-nums">{index}</span>
          <div>
            <h2 className="panel-heading text-base tracking-[-0.01em]">{title}</h2>
            {description && <p className="text-sm text-[var(--dim)] mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={gridClass}>{children}</div>
    </section>
  );
}

function KpiBand({ sla, cacheRate, errRate, days }: { sla: Sla; cacheRate: number | null; errRate: number; days: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Availability"
        value={`${sla.uptime}%`}
        hint={sla.uptimeMet ? `≥ ${sla.slaTarget}% SLA · ${days}d` : `below ${sla.slaTarget}% · ${days}d`}
        tone={sla.uptimeMet ? "#10b981" : "#ef4444"}
      />
      <StatCard label="Requests" value={sla.totalRequests.toLocaleString()} hint={`${days}d window`} />
      <StatCard label="Avg latency" value={`${sla.avgLatency}ms`} hint="per request" />
      <StatCard
        label="P99 latency"
        value={`${sla.p99Latency}ms`}
        hint={sla.latencyMet ? "within 5s target" : "exceeds target"}
        tone={sla.latencyMet ? "#10b981" : "#ef4444"}
      />
      <StatCard
        label="Cache hit rate"
        value={cacheRate !== null ? `${Math.round(cacheRate)}%` : "—"}
        hint="served from cache"
        tone={cacheRate !== null && cacheRate >= 50 ? "#10b981" : "#f59e0b"}
      />
      <StatCard
        label="Error rate"
        value={`${errRate.toFixed(2)}%`}
        hint={errRate === 0 ? "no errors" : `${sla.errors} errors`}
        tone={errRate === 0 ? "#10b981" : errRate > 5 ? "#ef4444" : "#f59e0b"}
      />
    </div>
  );
}

function MethodChips({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <p className="text-sm text-[var(--dim)]">No method data yet.</p>;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="card p-5">
      <h3 className="section-title mb-3">HTTP Methods</h3>
      <div className="space-y-2">
        {data.map((d) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <div key={d.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">{d.name}</span>
                <span className="text-[var(--dim)] text-xs">{pct}%</span>
              </span>
              <span className="font-medium tabular-nums">{d.value.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-[var(--dim)]">
        Methods from <span className="font-medium">api_key_logs</span> · <Link href="/docs" className="underline hover:text-[var(--ink)]">Docs</Link>
      </p>
    </div>
  );
}

function IncidentsPanel({ sla }: { sla: Sla }) {
  if (!sla.incidents.length) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="section-title">Incidents · last 30d</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sla.unresolvedIncidents ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}>
          {sla.unresolvedIncidents ? `${sla.unresolvedIncidents} unresolved` : "all resolved"}
        </span>
      </div>
      <ul className="mt-3 divide-y divide-[var(--border)]">
        {sla.incidents.slice(0, 5).map((inc) => (
          <li key={inc.id} className="py-2.5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{inc.incident_type}</p>
              <p className="text-xs text-[var(--dim)] truncate">
                {[inc.endpoint, inc.status_code ? String(inc.status_code) : null, inc.message].filter(Boolean).join(" · ") || "No details"}
              </p>
              <p className="text-[11px] text-[var(--dim)]">{new Date(inc.created_at).toLocaleString()} {inc.resolved ? "· resolved" : "· open"}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${inc.resolved ? "bg-[var(--muted)] text-[var(--dim)]" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300"}`}>
              {inc.resolved ? "resolved" : "open"}
            </span>
          </li>
        ))}
      </ul>
      {sla.incidents.length > 5 && <p className="mt-2 text-xs text-[var(--dim)]">+{sla.incidents.length - 5} more in history</p>}
      <div className="mt-3 flex gap-2">
        <Link href="/dashboard/history" className="text-xs font-medium text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4">View history →</Link>
        <Link href="/docs" className="text-xs text-[var(--dim)] hover:text-[var(--ink)] underline">Docs</Link>
      </div>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const sp = (await searchParams) ?? {};
  const rawDays = sp.days ?? "30";
  const days = rawDays === "7" ? 7 : rawDays === "90" ? 90 : 30;

  type KeyStat = Awaited<ReturnType<typeof getKeyUsageStats>>[number];

  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const [
    dailyUsage,
    latencyStats,
    peakHours,
    usageForecast,
    bandwidthStats,
    costEstimation,
    endpointBreakdown,
    formatDistribution,
    statusBreakdown,
    cacheTrend,
    keyStats,
    sla,
    periodComparison,
    methodBreakdown,
    usageStats,
    plan,
  ] = await Promise.all([
    safe(() => getDailyUsage(userId, days), [] as { date: string; count: number; ma7: number }[]),
    safe(() => getLatencyStats(userId, days), [] as { date: string; avg: number; p50: number; p95: number; p99: number }[]),
    safe(() => getPeakHours(userId, days), [] as { day: string; hour: number; count: number }[]),
    safe(() => getUsageForecast(userId), { forecast: [], dailyAvg: 0, monthlyUsed: 0, monthlyLimit: 100, daysUntilLimit: null }),
    safe(() => getBandwidthStats(userId, days), [] as { date: string; mb: number }[]),
    safe(() => getCostEstimation(userId), {
      plan: "free", monthlyPrice: 0, monthlyUsed: 0, monthlyLimit: 100, computeCost: 0, storageCost: 0, totalEstimatedCost: 0, storageGB: 0, costPerScreenshot: 0, recommendedPlan: null,
    }),
    safe(() => getEndpointBreakdown(userId, days), [] as { name: string; value: number }[]),
    safe(() => getFormatDistribution(userId, days), [] as { name: string; value: number }[]),
    safe(() => getStatusBreakdown(userId, days), [] as { name: string; value: number }[]),
    safe(() => getCacheTrend(userId, days), [] as { date: string; rate: number }[]),
    safe(() => getKeyUsageStats(userId, days), [] as KeyStat[]),
    safe(() => getSLAStats(userId, days), {
      uptime: 100, totalRequests: 0, errors: 0, avgLatency: 0, p99Latency: 0, slaTarget: 99.9, uptimeMet: true, latencyMet: true, incidents: [], unresolvedIncidents: 0,
    } as Sla),
    safe(() => getPeriodComparisons(userId), { thisWeek: 0, lastWeek: 0, weekDelta: 0, thisMonth: 0, lastMonth: 0, monthDelta: 0 }),
    safe(() => getMethodBreakdown(userId, days), [] as { name: string; value: number }[]),
    safe(() => getUsageStats(userId), null as Awaited<ReturnType<typeof getUsageStats>> | null),
    safe(() => getUserPlan(userId), "free" as const),
  ]);

  // Rate limit snapshot (best-effort, non-blocking for charts)
  const rateLimit = await safe(() => checkRateLimit(userId, plan), null as Awaited<ReturnType<typeof checkRateLimit>> | null);

  const lastCache = cacheTrend.length ? cacheTrend[cacheTrend.length - 1].rate : null;
  const totalOk = statusBreakdown.find((s) => s.name === "2xx")?.value ?? 0;
  const totals = statusBreakdown.reduce((s, d) => s + d.value, 0);
  const errRate = totals > 0 ? ((totals - totalOk) / totals) * 100 : 0;
  const hasAnyData = totals > 0 || dailyUsage.some((d) => d.count > 0) || sla.totalRequests > 0;
  const subtitle = hasAnyData ? `${days}-day window · live every 12-15s · credits & rate limits included` : `${days}-day window · no requests yet — try the playground`;
  const planLabel = getPlanLabel(plan);

  // Build usage snapshot for the credit strip (mirrors /api/v1/usage shape)
  const usageForStrip = usageStats
    ? {
        plan: usageStats.plan,
        entitlements: { rate_limit_per_minute: rateLimit?.limit ?? 0 },
        period: { reset_at: (usageStats as { quotaResetAt?: string | null }).quotaResetAt ?? null },
        requests: { used: usageStats.monthlyUsed, limit: usageStats.monthlyLimit, remaining: Math.max(0, usageStats.monthlyLimit - usageStats.monthlyUsed) },
        credits: {
          used_this_cycle: usageStats.creditsUsedThisCycle,
          granted_this_cycle: usageStats.creditsGrantedThisCycle,
          balance: usageStats.creditBalance,
          top_up_balance: usageStats.topUpBalance,
          overage_enabled: usageStats.overageEnabled,
        },
      }
    : null;

  const isLimited = rateLimit ? !rateLimit.allowed || rateLimit.remaining <= 0 : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">Analytics</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dim)]">
              <span className={`h-1.5 w-1.5 rounded-full ${plan === "free" ? "bg-[var(--dim)]" : "bg-emerald-500"}`} />
              {planLabel} · {rateLimit ? `${rateLimit.limit}/min` : ""}
            </span>
            {isLimited && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300 dark:ring-red-800">
                Rate limited
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--dim)]">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <AnalyticsActionBar />
            <Link href="/dashboard" className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]">Dashboard →</Link>
            <Link href="/dashboard/playground" className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-white dark:text-black">Playground</Link>
          </div>
        </div>
        <Suspense fallback={<div className="h-8 w-40 rounded-full bg-[var(--muted)] animate-pulse" />}>
          <AnalyticsControls initialDays={String(days)} />
        </Suspense>
      </div>

      <AnalyticsLiveRefresh intervalMs={15000} />

      {usageForStrip && <AnalyticsCreditStrip initial={usageForStrip as never} />}

      {rateLimit && isLimited && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">Rate limited — {rateLimit.limit}/min exceeded</p>
            <p className="text-xs text-red-700 dark:text-red-400">Retry in {Math.ceil(rateLimit.retryAfterMs / 1000)}s · Playground and <code className="rounded bg-white px-1">/api/v1/screenshots</code> share the window. History & Dashboard poll separately.</p>
          </div>
          <Link href="/dashboard/plan" className="hidden sm:inline-flex rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">Raise limit</Link>
        </div>
      )}

      {!hasAnyData && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">No analytics yet</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            Capture a screenshot in <Link href="/dashboard/playground" className="underline">Playground</Link> or via <Link href="/dashboard/api-keys" className="underline">API keys</Link>. Charts populate after your first request via <code className="rounded bg-white px-1">POST /api/take</code> or <code className="rounded bg-white px-1">POST /api/v1/screenshots</code>. <Link href="/docs" className="underline">Docs →</Link>
          </p>
        </div>
      )}

      <KpiBand sla={sla} cacheRate={lastCache} errRate={errRate} days={days} />

      <Section
        index="01"
        title="Reliability"
        description={`SLA and incidents · last ${days} days · source: api_key_logs + history`}
        actions={
          <Link href="/dashboard/history" className="text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4">
            History →
          </Link>
        }
      >
        <SLAMonitor data={sla} />
      </Section>

      {sla.incidents.length > 0 && <IncidentsPanel sla={sla} />}

      <Section
        index="02"
        title="Usage Trends"
        description="Requests & latency per day — from API logs (Playground + API) · cache hits excluded from latency avg"
        actions={<span className="text-xs text-[var(--dim)]">{days}d · live</span>}
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <UsageChart data={dailyUsage} />
        <LatencyChart data={latencyStats} />
      </Section>

      <Section
        index="02b"
        title="Period Comparison"
        description="Week-over-week and month-over-month — credits consumed track with requests"
        actions={<Link href="/dashboard" className="text-xs text-[var(--dim)] hover:text-[var(--ink)] underline">Dashboard →</Link>}
      >
        <PeriodComparison data={periodComparison} />
      </Section>

      <Section
        index="03"
        title="Patterns"
        description="Peak hours & 30-day forecast — includes PDF/video credit weighting"
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <PeakHoursHeatmap data={peakHours} />
        <UsageForecast data={usageForecast} />
      </Section>

      <Section
        index="04"
        title="Breakdowns"
        description="Endpoint, status, format & cache · Playground vs API split via history metadata"
        actions={<span className="text-xs text-[var(--dim)]">{totals.toLocaleString()} req · {days}d</span>}
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <EndpointPie data={endpointBreakdown} />
        <StatusPie data={statusBreakdown} />
        <FormatPie data={formatDistribution} />
        <CacheTrendChart data={cacheTrend} />
      </Section>

      {methodBreakdown.length > 0 && (
        <Section index="04b" title="Methods" description="HTTP verb distribution — GET /api/take vs POST /api/take & /api/v1/screenshots" gridClass="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MethodChips data={methodBreakdown} />
          <div className="lg:col-span-2 flex items-center rounded-xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--dim)]">
            <p>
              Filter by method in <Link href="/dashboard/history" className="font-medium text-[var(--ink)] underline">History</Link> or inspect per-key usage below. Playground uses <code className="rounded bg-white px-1">POST /api/take</code> with Clerk session; API keys hit <code className="rounded bg-white px-1">/api/v1/screenshots</code>. <Link href="/docs" className="underline">Docs →</Link>
            </p>
          </div>
        </Section>
      )}

      <Section
        index="05"
        title="API Key Health"
        description="Calls, errors, latency per key — last 30 days · rate-limited keys show amber"
        actions={
          <Link href="/dashboard/api-keys" className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium hover:bg-[var(--muted)]">
            Manage keys →
          </Link>
        }
        gridClass="grid grid-cols-1"
      >
        <KeyHealthTable
          data={keyStats.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            isActive: k.isActive,
            calls: k.calls,
            errors: k.errors,
            errorRate: k.errorRate,
            avgLatency: k.avgLatency,
            p95Latency: k.p95Latency,
            health: k.health,
            lastUsedAt: k.lastUsedAt,
            callsPerDay: k.callsPerDay,
          }))}
        />
      </Section>

      <Section
        index="06"
        title="Infrastructure & Cost"
        description="Egress and estimated spend — credits: png=1, pdf=5/page, video=max(5,s) · geo ×2"
        actions={<Link href="/dashboard/plan" className="text-xs text-[var(--dim)] hover:text-[var(--ink)] underline">Billing →</Link>}
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <BandwidthChart data={bandwidthStats} />
        <CostEstimation data={costEstimation} />
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3">
        <p className="text-xs text-[var(--dim)]">
          Need details? <Link href="/dashboard/history" className="font-medium text-[var(--ink)] underline">History</Link> · <Link href="/dashboard/api-keys" className="font-medium text-[var(--ink)] underline">Keys</Link> · <Link href="/dashboard/playground" className="font-medium text-[var(--ink)] underline">Playground</Link> · <Link href="/docs" className="underline">Docs</Link> · live refresh auto-runs
        </p>
        <Suspense fallback={<div className="h-8 w-40 rounded-full bg-[var(--muted)] animate-pulse" />}>
          <AnalyticsControls initialDays={String(days)} />
        </Suspense>
      </div>
    </div>
  );
}
