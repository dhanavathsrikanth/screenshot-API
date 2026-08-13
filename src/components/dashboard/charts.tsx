"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#ef4444", "#10b981", "#a855f7"];

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card card-lift p-6 ${className}`}>
      <h3 className="eyebrow text-zinc-400 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex items-center justify-center h-[200px] text-sm text-zinc-400">{text}</div>;
}

// ─── Moving Average Usage Chart ─────────────────────────────────────────

export function UsageChart({ data }: { data: { date: string; count: number; ma7: number }[] }) {
  if (!data.length) return <ChartCard title="Daily Usage (7-day moving average)"><Empty text="No data yet" /></ChartCard>;
  return (
    <ChartCard title="Daily Usage (7-day moving average)">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)" }} />
          <Legend />
          <Area type="monotone" dataKey="count" name="Actual" stroke="#6366f1" fill="url(#ug)" strokeWidth={1.5} />
          <Line type="monotone" dataKey="ma7" name="7-day avg" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Latency Chart with P50/P95/P99 ────────────────────────────────────

export function LatencyChart({ data }: { data: { date: string; avg: number; p50: number; p95: number; p99: number }[] }) {
  if (!data.length) return <ChartCard title="Response Latency"><Empty text="No latency data yet" /></ChartCard>;
  return (
    <ChartCard title="Response Latency (ms) — P50 / P95 / P99">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)" }} />
          <Legend />
          <Line type="monotone" dataKey="p50" name="P50" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p95" name="P95" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p99" name="P99" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Peak Hours Heatmap ────────────────────────────────────────────────

export function PeakHoursHeatmap({ data }: { data: { day: string; hour: number; count: number }[] }) {
  if (!data.length) return <ChartCard title="Peak Usage Hours"><Empty text="No data yet" /></ChartCard>;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  function intensity(count: number) {
    const ratio = count / maxCount;
    if (ratio === 0) return "bg-zinc-100 dark:bg-zinc-800";
    if (ratio < 0.25) return "bg-indigo-100 dark:bg-indigo-900/40";
    if (ratio < 0.5) return "bg-indigo-200 dark:bg-indigo-800/50";
    if (ratio < 0.75) return "bg-indigo-400 dark:bg-indigo-600/60";
    return "bg-indigo-600 dark:bg-indigo-500";
  }

  return (
    <ChartCard title="Peak Usage Hours (UTC)">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex gap-0.5 mb-1 ml-10">
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-zinc-400">{h}</div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day} className="flex gap-0.5 mb-0.5 items-center">
              <div className="w-9 text-[10px] text-zinc-500 text-right pr-1">{day}</div>
              {hours.map((h) => {
                const cell = data.find((d) => d.day === day && d.hour === h);
                const count = cell?.count ?? 0;
                return (
                  <div
                    key={h}
                    className={`flex-1 aspect-square rounded-sm ${intensity(count)} transition-colors`}
                    title={`${day} ${h}:00 — ${count} calls`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

// ─── Usage Forecast ────────────────────────────────────────────────────

export function UsageForecast({ data }: { data: { forecast: { date: string; predicted: number; upper: number }[]; dailyAvg: number; monthlyUsed: number; monthlyLimit: number; daysUntilLimit: number | null } }) {
  if (!data.forecast?.length) return <ChartCard title="Usage Forecast"><Empty text="Need at least 7 days of data" /></ChartCard>;

  const usagePct = data.monthlyLimit > 0 ? Math.round((data.monthlyUsed / data.monthlyLimit) * 100) : 0;

  return (
    <ChartCard title="30-Day Usage Forecast">
      <div className="flex items-center gap-4 mb-3">
        <div className="text-sm">
          <span className="text-zinc-500">Daily avg: </span>
          <span className="font-semibold">{data.dailyAvg}</span>
        </div>
        {data.daysUntilLimit !== null && (
          <div className="text-sm">
            <span className="text-zinc-500">Limit in: </span>
            <span className={`font-semibold ${data.daysUntilLimit <= 7 ? "text-red-500" : data.daysUntilLimit <= 14 ? "text-amber-500" : "text-green-500"}`}>
              ~{data.daysUntilLimit} days
            </span>
          </div>
        )}
        <div className="text-sm">
          <span className="text-zinc-500">Used: </span>
          <span className="font-semibold">{usagePct}%</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data.forecast}>
          <defs>
            <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)" }} />
          <Legend />
          <Area type="monotone" dataKey="upper" name="Upper bound" stroke="none" fill="url(#fg)" />
          <Line type="monotone" dataKey="predicted" name="Predicted" stroke="#ef4444" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Cost Estimation ───────────────────────────────────────────────────

export function CostEstimation({ data }: { data: { plan: string; monthlyPrice: number; monthlyUsed: number; monthlyLimit: number; computeCost: number; storageCost: number; totalEstimatedCost: number; storageGB: number; costPerScreenshot: number; recommendedPlan: string | null } }) {
  return (
    <ChartCard title="Cost Estimation">
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Current plan</span>
          <span className="font-semibold capitalize">{data.plan}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Monthly subscription</span>
          <span className="font-medium">${data.monthlyPrice}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Compute cost ({data.monthlyUsed} calls)</span>
          <span className="font-medium">${data.computeCost.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Storage cost ({data.storageGB} GB)</span>
          <span className="font-medium">${data.storageCost.toFixed(4)}</span>
        </div>
        <div className="border-t border-[var(--border)] pt-2 flex justify-between text-sm font-semibold">
          <span>Estimated overage</span>
          <span className={data.totalEstimatedCost > 0 ? "text-amber-500" : "text-green-500"}>
            ${data.totalEstimatedCost.toFixed(4)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Cost per screenshot</span>
          <span className="font-mono text-xs">${data.costPerScreenshot.toFixed(6)}</span>
        </div>
        {data.recommendedPlan && (
          <div className="mt-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 p-3">
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Consider upgrading to <span className="font-semibold">{data.recommendedPlan}</span> for better value at your usage level.
            </p>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

// ─── Period Comparison Cards ────────────────────────────────────────────

export function PeriodComparison({ data }: { data: { thisWeek: number; lastWeek: number; weekDelta: number; thisMonth: number; lastMonth: number; monthDelta: number } }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <ChartCard title="Week over Week">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold">{data.thisWeek.toLocaleString()}</span>
          <span className={`text-sm font-medium ${data.weekDelta > 0 ? "text-green-500" : data.weekDelta < 0 ? "text-red-500" : "text-zinc-400"}`}>
            {data.weekDelta > 0 ? "+" : ""}{data.weekDelta}%
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">vs {data.lastWeek.toLocaleString()} last week</p>
      </ChartCard>
      <ChartCard title="Month over Month">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold">{data.thisMonth.toLocaleString()}</span>
          <span className={`text-sm font-medium ${data.monthDelta > 0 ? "text-green-500" : data.monthDelta < 0 ? "text-red-500" : "text-zinc-400"}`}>
            {data.monthDelta > 0 ? "+" : ""}{data.monthDelta}%
          </span>
        </div>
        <p className="text-xs text-zinc-400 mt-1">vs {data.lastMonth.toLocaleString()} last month</p>
      </ChartCard>
    </div>
  );
}

// ─── Cache Trend ───────────────────────────────────────────────────────

export function CacheTrendChart({ data }: { data: { date: string; rate: number }[] }) {
  if (!data.length) return <ChartCard title="Cache Hit Rate Trend"><Empty text="No data yet" /></ChartCard>;
  return (
    <ChartCard title="Cache Hit Rate Trend (%)">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} domain={[0, 100]} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)" }} formatter={(value) => [`${value}%`, "Cache Rate"]} />
          <Area type="monotone" dataKey="rate" stroke="#10b981" fill="url(#cg)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Pie Charts ────────────────────────────────────────────────────────

export function EndpointPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartCard title="Endpoint Breakdown"><Empty text="No data yet" /></ChartCard>;
  return (
    <ChartCard title="Endpoint Breakdown">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)" }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function FormatPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartCard title="Format Distribution"><Empty text="No screenshots yet" /></ChartCard>;
  return (
    <ChartCard title="Format Distribution">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)" }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartCard title="Status Codes"><Empty text="No data yet" /></ChartCard>;
  const sc: Record<string, string> = { "2xx": "#10b981", "4xx": "#f59e0b", "5xx": "#ef4444" };
  return (
    <ChartCard title="Status Codes">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
            {data.map((entry, i) => <Cell key={i} fill={sc[entry.name] ?? COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)" }} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Bandwidth ─────────────────────────────────────────────────────────

export function BandwidthChart({ data }: { data: { date: string; mb: number }[] }) {
  if (!data.length) return <ChartCard title="Bandwidth Usage"><Empty text="No data yet" /></ChartCard>;
  return (
    <ChartCard title="Bandwidth Usage (MB)">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={(v) => v.slice(5)} />
          <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} />
          <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)" }} formatter={(value) => [`${value} MB`, "Bandwidth"]} />
          <Bar dataKey="mb" fill="#a855f7" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── API Key Health Table ──────────────────────────────────────────────

export function KeyHealthTable({ data }: { data: { id: string; name: string; prefix: string; isActive: boolean; calls: number; errors: number; errorRate: number; avgLatency: number; p95Latency: number; health: string; lastUsedAt: string | null; callsPerDay: number }[] }) {
  if (!data.length) return <ChartCard title="API Key Health"><Empty text="No API keys yet" /></ChartCard>;

  const healthStyles: Record<string, string> = {
    healthy: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    inactive: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  };

  return (
    <ChartCard title="API Key Health Dashboard">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-2 text-zinc-500 font-medium">Key</th>
              <th className="text-center py-2 text-zinc-500 font-medium">Health</th>
              <th className="text-right py-2 text-zinc-500 font-medium">Calls</th>
              <th className="text-right py-2 text-zinc-500 font-medium">Errors</th>
              <th className="text-right py-2 text-zinc-500 font-medium">Avg ms</th>
              <th className="text-right py-2 text-zinc-500 font-medium">P95 ms</th>
              <th className="text-right py-2 text-zinc-500 font-medium">Calls/day</th>
              <th className="text-right py-2 text-zinc-500 font-medium">Last Used</th>
            </tr>
          </thead>
          <tbody>
            {data.map((k) => (
              <tr key={k.id} className="border-b border-[var(--border)] last:border-0">
                <td className="py-2.5">
                  <span className="font-medium">{k.name}</span>
                  <span className="ml-2 text-xs text-zinc-400 font-mono">{k.prefix}...</span>
                </td>
                <td className="py-2.5 text-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${healthStyles[k.health] ?? healthStyles.inactive}`}>
                    {k.health}
                  </span>
                </td>
                <td className="py-2.5 text-right font-mono">{k.calls.toLocaleString()}</td>
                <td className={`py-2.5 text-right font-mono ${k.errors > 0 ? "text-red-500" : ""}`}>{k.errors}</td>
                <td className="py-2.5 text-right font-mono">{k.avgLatency}</td>
                <td className="py-2.5 text-right font-mono">{k.p95Latency}</td>
                <td className="py-2.5 text-right font-mono">{k.callsPerDay}</td>
                <td className="py-2.5 text-right text-zinc-400 text-xs">
                  {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ─── Usage Alerts ──────────────────────────────────────────────────────

export function UsageAlerts({ data }: { data: { id: string; alert_type: string; threshold_pct: number; triggered_at: string; acknowledged: boolean }[] }) {
  if (!data.length) return null;

  const unacknowledged = data.filter((a) => !a.acknowledged);
  if (!unacknowledged.length) return null;

  return (
    <div className="space-y-2">
      {unacknowledged.map((alert) => (
        <div key={alert.id} className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
          <svg className="h-5 w-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              You&apos;ve used {alert.threshold_pct}% of your monthly quota
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Triggered {new Date(alert.triggered_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SLA Monitor ───────────────────────────────────────────────────────

export function SLAMonitor({ data }: { data: { uptime: number; totalRequests: number; errors: number; avgLatency: number; p99Latency: number; slaTarget: number; uptimeMet: boolean; latencyMet: boolean; incidents: { id: string; incident_type: string; message: string | null; created_at: string; resolved: boolean }[]; unresolvedIncidents: number } }) {
  return (
    <ChartCard title="SLA Status">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className={`text-2xl font-bold ${data.uptimeMet ? "text-green-500" : "text-red-500"}`}>{data.uptime}%</div>
          <div className="text-xs text-zinc-400">Uptime</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{data.totalRequests.toLocaleString()}</div>
          <div className="text-xs text-zinc-400">Total Requests</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{data.avgLatency}ms</div>
          <div className="text-xs text-zinc-400">Avg Latency</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${data.latencyMet ? "text-green-500" : "text-red-500"}`}>{data.p99Latency}ms</div>
          <div className="text-xs text-zinc-400">P99 Latency</div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${data.uptimeMet ? "bg-green-500" : "bg-red-500"}`} />
          <span>Uptime {data.uptimeMet ? "meets" : "below"} {data.slaTarget}% SLA</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${data.latencyMet ? "bg-green-500" : "bg-red-500"}`} />
          <span>Latency {data.latencyMet ? "within" : "exceeds"} 5s SLA target</span>
        </div>
        {data.unresolvedIncidents > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-500">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{data.unresolvedIncidents} unresolved incident(s)</span>
          </div>
        )}
      </div>
      {data.incidents.length > 0 && (
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <p className="text-xs font-medium text-zinc-500 mb-2">Recent Incidents</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {data.incidents.slice(0, 5).map((inc) => (
              <div key={inc.id} className="flex items-center gap-2 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full ${inc.resolved ? "bg-green-400" : "bg-red-400"}`} />
                <span className="text-zinc-400">{new Date(inc.created_at).toLocaleDateString()}</span>
                <span className="truncate">{inc.message ?? inc.incident_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ─── Smart Upgrade Prompt ──────────────────────────────────────────────

export function UpgradePrompt({ data }: { data: { plan: string; monthlyUsed: number; monthlyLimit: number; recommendedPlan: string | null } }) {
  const usagePct = data.monthlyLimit > 0 ? Math.round((data.monthlyUsed / data.monthlyLimit) * 100) : 0;

  if (usagePct < 60 && !data.recommendedPlan) return null;

  const planPrices: Record<string, string> = { starter: "$9/mo", pro: "$49/mo" };
  const planLimits: Record<string, string> = { starter: "2,500", pro: "15,000" };

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/20 p-6">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50">
          <svg className="h-6 w-6 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
            {usagePct >= 80 ? "You're growing fast!" : "Unlock more power"}
          </h3>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
            {usagePct >= 80
              ? `You've used ${usagePct}% of your ${data.plan} plan. Upgrade to keep scaling.`
              : `Upgrade to ${data.recommendedPlan ?? "pro"} for higher limits and lower per-screenshot costs.`
            }
          </p>
          {data.recommendedPlan && (
            <div className="mt-3 flex items-center gap-3">
              <div className="text-sm">
                <span className="font-semibold capitalize">{data.recommendedPlan}</span>
                <span className="text-zinc-500 ml-1">{planPrices[data.recommendedPlan]}</span>
                <span className="text-zinc-400 ml-1">({planLimits[data.recommendedPlan]} screenshots/mo)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
