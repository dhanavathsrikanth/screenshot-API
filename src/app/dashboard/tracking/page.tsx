import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getRequestLogs, getRequestLogCount } from "@/lib/redis";
import {
  getEndpointBreakdown,
  getMethodBreakdown,
  getFormatDistribution,
  getStatusBreakdown,
  getCacheTrend,
  getKeyUsageStats,
} from "@/app/actions/analytics";
import {
  EndpointPie,
  FormatPie,
  StatusPie,
  CacheTrendChart,
} from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="eyebrow text-zinc-400 mb-4">{children}</h2>;
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card card-lift p-4">
      <p className="eyebrow text-zinc-400">{label}</p>
      <p className="text-2xl font-bold mt-2 tracking-tight">{value}</p>
    </div>
  );
}

export default async function TrackingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let endpointBreakdown: { name: string; value: number }[] = [];
  let methodBreakdown: { name: string; value: number }[] = [];
  let formatDistribution: { name: string; value: number }[] = [];
  let statusBreakdown: { name: string; value: number }[] = [];
  let cacheTrend: { date: string; rate: number; total: number; cached: number }[] = [];
  let keyUsageStats: {
    id: string;
    name: string;
    prefix: string;
    isActive: boolean;
    calls: number;
    errors: number;
    errorRate: number;
    avgLatency: number;
    p95Latency: number;
    health: "healthy" | "warning" | "inactive";
    lastUsedAt: string | null;
    createdAt: string;
    callsPerDay: number;
  }[] = [];
  let requestLogs: { ts: string; endpoint: string; method: string; status: number; ms: number; cached: boolean; url?: string }[] = [];
  let totalLogs = 0;

  try {
    [endpointBreakdown, methodBreakdown, formatDistribution, statusBreakdown, cacheTrend, keyUsageStats, requestLogs, totalLogs] =
      await Promise.all([
        getEndpointBreakdown(userId),
        getMethodBreakdown(userId),
        getFormatDistribution(userId),
        getStatusBreakdown(userId),
        getCacheTrend(userId),
        getKeyUsageStats(userId),
        getRequestLogs(userId, 0, 100).catch(() => []),
        getRequestLogCount(userId).catch(() => 0),
      ]);
  } catch {
    // All data stays as defaults
  }

  const displayedLogs = requestLogs.slice(0, 50);

  // Compute per-key summary for the top section
  const totalKeyCalls = keyUsageStats.reduce((sum, k) => sum + k.calls, 0);
  const totalKeyErrors = keyUsageStats.reduce((sum, k) => sum + k.errors, 0);
  const activeKeys = keyUsageStats.filter((k) => k.isActive);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="API Tracking"
        title="Request Logs & Key Health"
        description="Request logs, endpoint breakdown, and API key health"
      />

      {/* API Key Summary Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Keys" value={activeKeys.length} />
        <StatCard label="Total API Calls (30d)" value={totalKeyCalls.toLocaleString()} />
        <StatCard
          label="Error Rate"
          value={totalKeyCalls > 0 ? `${Math.round((totalKeyErrors / totalKeyCalls) * 100)}%` : "0%"}
        />
        <StatCard label="Requests Logged" value={totalLogs.toLocaleString()} />
      </section>

      {/* Request Log */}
      <section>
        <h2 className="text-sm font-semibold mb-4">
          Request Log
          {totalLogs > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-400">
              ({totalLogs.toLocaleString()} total)
            </span>
          )}
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-zinc-500 text-left uppercase text-xs">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Latency</th>
                <th className="px-4 py-3 font-medium">Cached</th>
              </tr>
            </thead>
            <tbody>
              {displayedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                    No request logs yet. Make an API call to see data here.
                  </td>
                </tr>
              ) : (
                displayedLogs.map((log, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--border)] hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {timeAgo(log.ts)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.endpoint}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.method === "GET"
                            ? "bg-blue-500/10 text-blue-600"
                            : log.method === "POST"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-zinc-500/10 text-zinc-500"
                        }`}
                      >
                        {log.method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status >= 200 && log.status < 300
                            ? "bg-green-500/10 text-green-600"
                            : log.status >= 400 && log.status < 500
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-red-500/10 text-red-600"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap">
                      {log.ms}ms
                    </td>
                    <td className="px-4 py-3">
                      {log.cached ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600">
                          Hit
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-500/10 text-zinc-500">
                          Miss
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Breakdowns */}
      <section>
        <SectionTitle>Breakdowns</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <EndpointPie data={endpointBreakdown} />
          <FormatPie data={formatDistribution} />
          <StatusPie data={statusBreakdown} />
          <EndpointPie data={methodBreakdown} />
        </div>
      </section>

      {/* Cache Performance */}
      <section>
        <SectionTitle>Cache Performance</SectionTitle>
        <CacheTrendChart data={cacheTrend} />
      </section>

      {/* API Key Stats */}
      <section>
        <SectionTitle>API Key Stats</SectionTitle>
        {keyUsageStats.length === 0 ? (
          <div className="card border-dashed p-8 text-center">
            <p className="text-sm text-zinc-500">No API keys yet. Create one in the API Keys section.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keyUsageStats.map((key) => (
              <div
                key={key.id}
                className="card card-lift p-4 flex items-center gap-4"
              >
                <div className="flex-shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      key.health === "healthy"
                        ? "bg-green-500/10 text-green-600"
                        : key.health === "warning"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-zinc-500/10 text-zinc-500"
                    }`}
                  >
                    {key.health}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{key.name}</p>
                    <code className="text-xs text-zinc-500 font-mono">{key.prefix}...</code>
                    {!key.isActive && (
                      <span className="text-[10px] text-zinc-400 uppercase">revoked</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                    <span>{key.calls.toLocaleString()} calls</span>
                    <span>&middot;</span>
                    <span>{key.errorRate}% error</span>
                    <span>&middot;</span>
                    <span>{key.avgLatency}ms avg</span>
                    <span>&middot;</span>
                    <span>{key.callsPerDay}/day</span>
                  </div>
                </div>
                <div className="flex-shrink-0 text-xs text-zinc-400">
                  {key.lastUsedAt ? timeAgo(key.lastUsedAt) : "never used"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
