import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getSLAStats } from "@/app/actions/analytics";

export default async function SLAPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const sla = await getSLAStats(userId, 30);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">SLA Monitor</h1>
        <p className="text-sm text-zinc-500">Uptime, performance, and incident history for the last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 text-center">
          <div className={`text-3xl font-bold ${sla.uptimeMet ? "text-green-500" : "text-red-500"}`}>{sla.uptime}%</div>
          <div className="text-xs text-zinc-400 mt-1">Uptime (SLA: {sla.slaTarget}%)</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 text-center">
          <div className="text-3xl font-bold">{sla.totalRequests.toLocaleString()}</div>
          <div className="text-xs text-zinc-400 mt-1">Total Requests</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 text-center">
          <div className="text-3xl font-bold">{sla.avgLatency}ms</div>
          <div className="text-xs text-zinc-400 mt-1">Avg Latency</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 text-center">
          <div className={`text-3xl font-bold ${sla.latencyMet ? "text-green-500" : "text-red-500"}`}>{sla.p99Latency}ms</div>
          <div className="text-xs text-zinc-400 mt-1">P99 Latency (target: &lt;5s)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
          <h3 className="text-sm font-medium mb-3">SLA Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${sla.uptimeMet ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm">Uptime Target</span>
              </div>
              <span className={`text-sm font-medium ${sla.uptimeMet ? "text-green-500" : "text-red-500"}`}>
                {sla.uptimeMet ? "MET" : "BREACHED"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${sla.latencyMet ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm">Latency Target (&lt;5s)</span>
              </div>
              <span className={`text-sm font-medium ${sla.latencyMet ? "text-green-500" : "text-red-500"}`}>
                {sla.latencyMet ? "MET" : "BREACHED"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${sla.errors === 0 ? "bg-green-500" : "bg-amber-500"}`} />
                <span className="text-sm">Error Rate</span>
              </div>
              <span className="text-sm font-medium">{sla.totalRequests > 0 ? ((sla.errors / sla.totalRequests) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
          <h3 className="text-sm font-medium mb-3">Incident Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Total incidents (30d)</span>
              <span className="font-medium">{sla.incidents.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Unresolved</span>
              <span className={`font-medium ${sla.unresolvedIncidents > 0 ? "text-amber-500" : "text-green-500"}`}>{sla.unresolvedIncidents}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Server errors (5xx)</span>
              <span className={`font-medium ${sla.errors > 0 ? "text-red-500" : ""}`}>{sla.errors}</span>
            </div>
          </div>
        </div>
      </div>

      {sla.incidents.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
          <h3 className="text-sm font-medium mb-4">Incident History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 text-zinc-500 font-medium">Date</th>
                  <th className="text-left py-2 text-zinc-500 font-medium">Type</th>
                  <th className="text-left py-2 text-zinc-500 font-medium">Endpoint</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Status</th>
                  <th className="text-right py-2 text-zinc-500 font-medium">Latency</th>
                  <th className="text-left py-2 text-zinc-500 font-medium">Message</th>
                  <th className="text-center py-2 text-zinc-500 font-medium">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {sla.incidents.map((inc: any) => (
                  <tr key={inc.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 text-xs">{new Date(inc.created_at).toLocaleString()}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${inc.incident_type === "server_error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                        {inc.incident_type}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-xs">{inc.endpoint ?? "-"}</td>
                    <td className="py-2.5 text-right font-mono text-xs">{inc.status_code ?? "-"}</td>
                    <td className="py-2.5 text-right font-mono text-xs">{inc.response_time_ms ? `${inc.response_time_ms}ms` : "-"}</td>
                    <td className="py-2.5 text-xs text-zinc-500 max-w-[200px] truncate">{inc.message ?? "-"}</td>
                    <td className="py-2.5 text-center">
                      <div className={`w-2 h-2 rounded-full mx-auto ${inc.resolved ? "bg-green-400" : "bg-red-400"}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
