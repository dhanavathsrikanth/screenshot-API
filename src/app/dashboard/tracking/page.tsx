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
  KeyHealthTable,
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

  const [
    endpointBreakdown,
    methodBreakdown,
    formatDistribution,
    statusBreakdown,
    cacheTrend,
    keyUsageStats,
    requestLogs,
    totalLogs,
  ] = await Promise.all([
    getEndpointBreakdown(userId),
    getMethodBreakdown(userId),
    getFormatDistribution(userId),
    getStatusBreakdown(userId),
    getCacheTrend(userId),
    getKeyUsageStats(userId),
    getRequestLogs(userId, 0, 100),
    getRequestLogCount(userId),
  ]);

  const displayedLogs = requestLogs.slice(0, 50);

  return (
    <div className="space-y-8 container">
      <div>
        <h1 className="text-2xl font-bold">API Tracking</h1>
        <p className="text-muted-foreground">
          Request logs, endpoint breakdown, and key health
        </p>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <EndpointPie data={endpointBreakdown} />
          <FormatPie data={formatDistribution} />
          <StatusPie data={statusBreakdown} />
        </div>
      </section>

      {/* Cache Performance */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Cache Performance</h2>
        <CacheTrendChart data={cacheTrend} />
      </section>

      {/* Key Health */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Key Health</h2>
        <KeyHealthTable data={keyUsageStats} />
      </section>
    </div>
  );
}
