import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
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
} from "@/app/actions/analytics";
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
} from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";

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
  children,
  gridClass = "grid grid-cols-1 lg:grid-cols-2 gap-4",
}: {
  index: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  gridClass?: string;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="section-title text-[var(--accent)] tabular-nums">{index}</span>
        <div>
          <h2 className="panel-heading text-base tracking-[-0.01em]">{title}</h2>
          {description && <p className="text-sm text-[var(--dim)] mt-0.5">{description}</p>}
        </div>
      </div>
      <div className={gridClass}>{children}</div>
    </section>
  );
}

function KpiBand({ sla, cacheRate, errRate }: { sla: Sla; cacheRate: number | null; errRate: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Availability"
        value={`${sla.uptime}%`}
        hint={sla.uptimeMet ? `≥ ${sla.slaTarget}% SLA` : "below SLA target"}
        tone={sla.uptimeMet ? "#10b981" : "#ef4444"}
      />
      <StatCard label="Requests" value={sla.totalRequests.toLocaleString()} hint="all time" />
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
        hint="overall"
        tone={errRate === 0 ? "#10b981" : "#f59e0b"}
      />
    </div>
  );
}

export default async function AnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  type KeyStat = Awaited<ReturnType<typeof getKeyUsageStats>>[number];
  type Sla = Awaited<ReturnType<typeof getSLAStats>>;

  // Each section degrades independently: a failure in one data source shows
  // that chart's built-in empty state instead of blanking the whole page.
  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const [dailyUsage, latencyStats, peakHours, usageForecast, bandwidthStats, costEstimation, endpointBreakdown, formatDistribution, statusBreakdown, cacheTrend, keyStats, sla] =
    await Promise.all([
      safe(() => getDailyUsage(userId), [] as { date: string; count: number; ma7: number }[]),
      safe(() => getLatencyStats(userId), [] as { date: string; avg: number; p50: number; p95: number; p99: number }[]),
      safe(() => getPeakHours(userId), [] as { day: string; hour: number; count: number }[]),
      safe(() => getUsageForecast(userId), {
        forecast: [],
        dailyAvg: 0,
        monthlyUsed: 0,
        monthlyLimit: 100,
        daysUntilLimit: null,
      }),
      safe(() => getBandwidthStats(userId), [] as { date: string; mb: number }[]),
      safe(() => getCostEstimation(userId), {
        plan: "free",
        monthlyPrice: 0,
        monthlyUsed: 0,
        monthlyLimit: 100,
        computeCost: 0,
        storageCost: 0,
        totalEstimatedCost: 0,
        storageGB: 0,
        costPerScreenshot: 0,
        recommendedPlan: null,
      }),
      safe(() => getEndpointBreakdown(userId), [] as { name: string; value: number }[]),
      safe(() => getFormatDistribution(userId), [] as { name: string; value: number }[]),
      safe(() => getStatusBreakdown(userId), [] as { name: string; value: number }[]),
      safe(() => getCacheTrend(userId), [] as { date: string; rate: number }[]),
      safe(() => getKeyUsageStats(userId), [] as KeyStat[]),
      safe(
        () => getSLAStats(userId, 30),
        {
          uptime: 100,
          totalRequests: 0,
          errors: 0,
          avgLatency: 0,
          p99Latency: 0,
          slaTarget: 99.9,
          uptimeMet: true,
          latencyMet: true,
          incidents: [],
          unresolvedIncidents: 0,
        } as Sla
      ),
    ]);

  const lastCache = cacheTrend.length ? cacheTrend[cacheTrend.length - 1].rate : null;
  const totalOk = statusBreakdown.find((s) => s.name === "2xx")?.value ?? 0;
  const totals = statusBreakdown.reduce((s, d) => s + d.value, 0);
  const errRate = totals > 0 ? ((totals - totalOk) / totals) * 100 : 0;

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Usage & Performance"
        description="Usage trends, request logs, reliability, and cost across your account"
      />

      <KpiBand sla={sla} cacheRate={lastCache} errRate={errRate} />

      <Section index="01" title="Reliability" description="Service-level metrics over the last 30 days">
        <SLAMonitor data={sla} />
      </Section>

      <Section
        index="02"
        title="Usage Trends"
        description="Request volume and response latency over time"
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <UsageChart data={dailyUsage} />
        <LatencyChart data={latencyStats} />
      </Section>

      <Section
        index="03"
        title="Patterns"
        description="When traffic peaks and how it may grow"
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <PeakHoursHeatmap data={peakHours} />
        <UsageForecast data={usageForecast} />
      </Section>

      <Section
        index="04"
        title="Request Breakdowns"
        description="How traffic splits by endpoint, outcome, and format"
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <EndpointPie data={endpointBreakdown} />
        <StatusPie data={statusBreakdown} />
        <FormatPie data={formatDistribution} />
        <CacheTrendChart data={cacheTrend} />
      </Section>

      <Section
        index="05"
        title="API Key Health"
        description="Per-key reliability, error rates, and usage"
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
        description="Bandwidth consumption and estimated spend"
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <BandwidthChart data={bandwidthStats} />
        <CostEstimation data={costEstimation} />
      </Section>
    </>
  );
}
