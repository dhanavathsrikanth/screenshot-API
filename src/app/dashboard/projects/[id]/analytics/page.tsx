import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getProject } from "@/app/actions/projects";
import {
  getProjectSummaryStats,
  getProjectDailyUsage,
  getProjectLatencyStats,
  getProjectPeakHours,
  getProjectEndpointBreakdown,
  getProjectFormatDistribution,
  getProjectStatusBreakdown,
  getProjectCacheTrend,
  getProjectKeyUsageStats,
  getProjectBandwidthStats,
} from "@/app/actions/project-analytics";
import {
  UsageChart,
  LatencyChart,
  PeakHoursHeatmap,
  BandwidthChart,
  EndpointPie,
  FormatPie,
  StatusPie,
  CacheTrendChart,
  KeyHealthTable,
} from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";

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

export default async function ProjectAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { id: projectId } = await params;
  const project = await getProject(userId, projectId);
  if (!project) notFound();

  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  const [
    summary,
    dailyUsage,
    latencyStats,
    peakHours,
    endpointBreakdown,
    formatDistribution,
    statusBreakdown,
    cacheTrend,
    keyStats,
    bandwidthStats,
  ] = await Promise.all([
    safe(() => getProjectSummaryStats(userId, projectId), {
      totalRequests: 0,
      avgLatency: 0,
      p99Latency: 0,
      cacheHitRate: 0,
      errorRate: 0,
      apiKeyCount: project.api_key_count ?? 0,
      screenshotCount: project.screenshot_count ?? 0,
      webhookCount: project.webhook_count ?? 0,
      usage30d: project.usage_30d ?? 0,
    }),
    safe(() => getProjectDailyUsage(userId, projectId), [] as { date: string; count: number; ma7: number }[]),
    safe(() => getProjectLatencyStats(userId, projectId), [] as { date: string; avg: number; p50: number; p95: number; p99: number }[]),
    safe(() => getProjectPeakHours(userId, projectId), [] as { day: string; hour: number; count: number }[]),
    safe(() => getProjectEndpointBreakdown(userId, projectId), [] as { name: string; value: number }[]),
    safe(() => getProjectFormatDistribution(userId, projectId), [] as { name: string; value: number }[]),
    safe(() => getProjectStatusBreakdown(userId, projectId), [] as { name: string; value: number }[]),
    safe(() => getProjectCacheTrend(userId, projectId), [] as { date: string; rate: number }[]),
    safe(() => getProjectKeyUsageStats(userId, projectId), []),
    safe(() => getProjectBandwidthStats(userId, projectId), [] as { date: string; mb: number }[]),
  ]);

  return (
    <>
      <div className="mb-2">
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1 text-sm text-[var(--dim)] hover:text-[var(--ink)] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          All projects
        </Link>
      </div>

      <PageHeader
        eyebrow="Project analytics"
        title={project.name}
        description="Usage, performance, and breakdowns scoped to this project"
        actions={
          <Link href={`/dashboard/history?project=${project.id}`} className="btn-secondary">
            View history
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Requests (30d)" value={summary.totalRequests.toLocaleString()} hint="API calls" />
        <StatCard label="Avg latency" value={`${summary.avgLatency}ms`} hint="per request" />
        <StatCard
          label="P99 latency"
          value={`${summary.p99Latency}ms`}
          hint="99th percentile"
          tone={summary.p99Latency > 5000 ? "#ef4444" : "#10b981"}
        />
        <StatCard
          label="Cache hit rate"
          value={`${summary.cacheHitRate}%`}
          hint="served from cache"
          tone={summary.cacheHitRate >= 50 ? "#10b981" : "#f59e0b"}
        />
        <StatCard
          label="Error rate"
          value={`${summary.errorRate.toFixed(2)}%`}
          hint="non-2xx responses"
          tone={summary.errorRate === 0 ? "#10b981" : "#f59e0b"}
        />
        <StatCard label="API keys" value={String(summary.apiKeyCount)} hint={`${summary.screenshotCount} screenshots`} />
      </div>

      <Section
        index="01"
        title="Usage Trends"
        description="Request volume and response latency for this project"
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <UsageChart data={dailyUsage} />
        <LatencyChart data={latencyStats} />
      </Section>

      <Section
        index="02"
        title="Traffic Patterns"
        description="When this project receives the most requests"
        gridClass="grid grid-cols-1 gap-4"
      >
        <PeakHoursHeatmap data={peakHours} />
      </Section>

      <Section
        index="03"
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
        index="04"
        title="API Key Health"
        description="Per-key reliability and usage within this project"
        gridClass="grid grid-cols-1"
      >
        <KeyHealthTable data={keyStats} />
      </Section>

      <Section
        index="05"
        title="Storage"
        description="Bandwidth consumed by screenshots in this project"
        gridClass="grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <BandwidthChart data={bandwidthStats} />
        <div className="card p-4 flex flex-col justify-center gap-3">
          <div>
            <p className="section-title">Project resources</p>
            <p className="mt-2 text-sm text-[var(--dim)]">
              {summary.apiKeyCount} API key{summary.apiKeyCount === 1 ? "" : "s"} ·{" "}
              {summary.screenshotCount} screenshot{summary.screenshotCount === 1 ? "" : "s"} ·{" "}
              {summary.webhookCount} webhook{summary.webhookCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/history?project=${project.id}`}
              className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
            >
              Screenshot history
            </Link>
            <span className="text-[var(--line)]">·</span>
            <Link href="/dashboard/api-keys" className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline">
              Manage API keys
            </Link>
            <span className="text-[var(--line)]">·</span>
            <Link href="/dashboard/webhooks" className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline">
              Manage webhooks
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
