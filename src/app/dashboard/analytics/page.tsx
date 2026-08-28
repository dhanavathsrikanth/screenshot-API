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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="eyebrow text-[var(--dim)] mb-4">{children}</h2>;
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Analytics"
        title="Usage & Performance"
        description="Usage trends, request logs, reliability, and cost across your account"
      />

      <section>
        <SectionTitle>Reliability (SLA)</SectionTitle>
        <SLAMonitor data={sla} />
      </section>

      <section>
        <SectionTitle>Usage Trends</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UsageChart data={dailyUsage} />
          <LatencyChart data={latencyStats} />
        </div>
      </section>

      <section>
        <SectionTitle>Patterns</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PeakHoursHeatmap data={peakHours} />
          <UsageForecast data={usageForecast} />
        </div>
      </section>

      <section>
        <SectionTitle>Request Breakdowns</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EndpointPie data={endpointBreakdown} />
          <StatusPie data={statusBreakdown} />
          <FormatPie data={formatDistribution} />
          <CacheTrendChart data={cacheTrend} />
        </div>
      </section>

      <section>
        <SectionTitle>API Key Health</SectionTitle>
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
      </section>

      <section>
        <SectionTitle>Infrastructure</SectionTitle>
        <BandwidthChart data={bandwidthStats} />
      </section>

      <section>
        <SectionTitle>Cost Analysis</SectionTitle>
        <CostEstimation data={costEstimation} />
      </section>
    </div>
  );
}
