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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
    <div className="space-y-8 container">
      <div>
        <h1 className="text-2xl font-bold">API Tracking</h1>
        <p className="text-muted-foreground">
          Request logs, endpoint breakdown, and key health
        </p>
      </div>

      {/* API Key Summary Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Active Keys</p>
          <p className="text-2xl font-bold mt-1">{activeKeys.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Total API Calls (30d)</p>
          <p className="text-2xl font-bold mt-1">{totalKeyCalls.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Error Rate</p>
          <p className="text-2xl font-bold mt-1">
            {totalKeyCalls > 0 ? `${Math.round((totalKeyErrors / totalKeyCalls) * 100)}%` : "0%"}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Requests Logged</p>
          <p className="text-2xl font-bold mt-1">{totalLogs.toLocaleString()}</p>
        </div>
      </section>

      {/* Request Log */}
      <section>
        <h2 className="text-lg font-semibold mb-4">
          Request Log
          {totalLogs > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-400">
              ({totalLogs.toLocaleString()} total)
            </span>
          )}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--background)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900 text-zinc-400 text-left uppercase text-xs">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Endpoint</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Latency</th>
                <th className="px-4 py-3">Cached</th>
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
                    className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                      {timeAgo(log.ts)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{log.endpoint}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.method === "GET"
                            ? "bg-blue-500/10 text-blue-400"
                            : log.method === "POST"
                              ? "bg-green-500/10 text-green-400"
                              : "bg-zinc-500/10 text-zinc-400"
                        }`}
                      >
                        {log.method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status >= 200 && log.status < 300
                            ? "bg-green-500/10 text-green-400"
                            : log.status >= 400 && log.status < 500
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-red-500/10 text-red-400"
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
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-400">
                          Hit
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-500/10 text-zinc-400">
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
        <h2 className="text-lg font-semibold mb-4">Breakdowns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <EndpointPie data={endpointBreakdown} />
          <FormatPie data={formatDistribution} />
          <StatusPie data={statusBreakdown} />
          <EndpointPie data={methodBreakdown} />
        </div>
      </section>

      {/* Cache Performance */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Cache Performance</h2>
        <CacheTrendChart data={cacheTrend} />
      </section>

      {/* API Key Stats */}
      <section>
        <h2 className="text-lg font-semibold mb-4">API Key Stats</h2>
        {keyUsageStats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <p className="text-sm text-zinc-500">No API keys yet. Create one in the API Keys section.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keyUsageStats.map((key) => (
              <div
                key={key.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 flex items-center gap-4"
              >
                <div className="flex-shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                      key.health === "healthy"
                        ? "bg-green-500/10 text-green-400"
                        : key.health === "warning"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-zinc-500/10 text-zinc-400"
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
