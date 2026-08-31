"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { UpgradeButton } from "@/components/upgrade-button";

// ─── Coherent chart palette ─────────────────────────────────────────────
// Brand orange is reserved for primary emphasis; semantic colours carry
// meaning (green=good, amber=warning, red=problem). Neutrals adapt to theme.
const ACCENT = "#f97316";
const ACCENT_SOFT = "#fb923c";
const GOOD = "#10b981";
const WARN = "#f59e0b";
const BAD = "#ef4444";
const VIOLET = "#8b5cf6";
const CYAN = "#22d3ee";
const SLATE = "#71717a";

export const COLORS = [ACCENT, CYAN, WARN, BAD, GOOD, VIOLET];

const AXIS_TICK = { fontSize: 11, fill: "var(--dim)" };

const TOOLTIP_STYLE = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--ink)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  fontSize: 12,
};

function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card p-6 flex flex-col ${className}`}>
      <div className="mb-4">
        <h3 className="section-title">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-[var(--dim)]">{subtitle}</p>}
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-[200px] text-sm text-[var(--dim)] border border-dashed border-[var(--border)] rounded-lg">
      {text}
    </div>
  );
}

// ─── Moving Average Usage Chart ─────────────────────────────────────────

export function UsageChart({ data }: { data: { date: string; count: number; ma7: number }[] }) {
  if (!data.length) return <ChartCard title="Daily Usage"><Empty text="No data yet" /></ChartCard>;
  return (
    <ChartCard title="Daily Usage" subtitle="Requests per day with 7-day moving average">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ACCENT} stopOpacity={0.25} />
              <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="count" name="Actual" stroke={ACCENT} fill="url(#ug)" strokeWidth={2} />
          <Line type="monotone" dataKey="ma7" name="7-day avg" stroke={ACCENT_SOFT} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Latency Chart with P50/P95/P99 ────────────────────────────────────

export function LatencyChart({ data }: { data: { date: string; avg: number; p50: number; p95: number; p99: number }[] }) {
  if (!data.length) return <ChartCard title="Response Latency"><Empty text="No latency data yet" /></ChartCard>;
  return (
    <ChartCard title="Response Latency" subtitle="Distribution across P50 / P95 / P99 (ms)">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="p50" name="P50" stroke={GOOD} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p95" name="P95" stroke={WARN} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p99" name="P99" stroke={BAD} strokeWidth={2} dot={false} strokeDasharray="5 5" />
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

  function CellColor(count: number) {
    if (count === 0) return { background: "var(--muted)" };
    const ratio = count / maxCount;
    if (ratio < 0.25) return { background: "color-mix(in srgb, var(--accent) 22%, transparent)" };
    if (ratio < 0.5) return { background: "color-mix(in srgb, var(--accent) 45%, transparent)" };
    if (ratio < 0.75) return { background: "color-mix(in srgb, var(--accent) 70%, transparent)" };
    return { background: "var(--accent)" };
  }

  return (
    <ChartCard title="Peak Usage Hours" subtitle="Request volume by day and hour (UTC)">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex gap-0.5 mb-1 ml-10">
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-[var(--dim)]">{h}</div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day} className="flex gap-0.5 mb-0.5 items-center">
              <div className="w-9 text-[10px] text-[var(--dim)] text-right pr-1">{day}</div>
              {hours.map((h) => {
                const cell = data.find((d) => d.day === day && d.hour === h);
                const count = cell?.count ?? 0;
                const color = CellColor(count);
                return (
                  <div
                    key={h}
                    className="flex-1 aspect-square rounded-sm transition-colors"
                    style={{ background: color.background }}
                    title={`${day} ${h}:00 — ${count} calls`}
                  />
                );
              })}
            </div>
          ))}
          <div className="mt-3 flex items-center gap-2 text-[10px] text-[var(--dim)]">
            <span className="mr-1">Less</span>
            {["var(--muted)", "color-mix(in srgb, var(--accent) 22%, transparent)", "color-mix(in srgb, var(--accent) 45%, transparent)", "color-mix(in srgb, var(--accent) 70%, transparent)", "var(--accent)"].map((c, i) => (
              <span key={i} className="h-2.5 w-5 rounded-sm" style={{ background: c }} />
            ))}
            <span className="ml-1">More</span>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

// ─── Usage Forecast ────────────────────────────────────────────────────

export function UsageForecast({ data }: { data: { forecast: { date: string; predicted: number; upper: number }[]; dailyAvg: number; monthlyUsed: number; monthlyLimit: number; daysUntilLimit: number | null } }) {
  if (!data.forecast?.length) return <ChartCard title="Usage Forecast"><Empty text="Need at least 7 days of data" /></ChartCard>;

  const usagePct = data.monthlyLimit > 0 ? Math.round((data.monthlyUsed / data.monthlyLimit) * 100) : 0;
  const limitTone = data.daysUntilLimit !== null && data.daysUntilLimit <= 7 ? BAD : data.daysUntilLimit !== null && data.daysUntilLimit <= 14 ? WARN : GOOD;

  return (
    <ChartCard title="30-Day Usage Forecast" subtitle="Projected requests based on recent usage">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight">{data.dailyAvg}</span>
          <span className="text-xs text-[var(--dim)]">daily avg</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight" style={{ color: limitTone }}>
            {data.daysUntilLimit !== null ? `~${data.daysUntilLimit}d` : "—"}
          </span>
          <span className="text-xs text-[var(--dim)]">until limit</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="h-1.5 w-24 rounded-full bg-[var(--muted)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(usagePct, 100)}%`, background: usagePct >= 80 ? BAD : usagePct >= 60 ? WARN : ACCENT }} />
          </div>
          <span className="text-xs font-medium">{usagePct}% used</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data.forecast}>
          <defs>
            <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ACCENT} stopOpacity={0.18} />
              <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="upper" name="Upper bound" stroke="none" fill="url(#fg)" />
          <Line type="monotone" dataKey="predicted" name="Predicted" stroke={ACCENT} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Cost Estimation ───────────────────────────────────────────────────

export function CostEstimation({ data }: { data: { plan: string; monthlyPrice: number; monthlyUsed: number; monthlyLimit: number; computeCost: number; storageCost: number; totalEstimatedCost: number; storageGB: number; costPerScreenshot: number; recommendedPlan: string | null } }) {
  const rows = [
    { label: "Monthly subscription", value: `$${data.monthlyPrice}` },
    { label: `Compute · ${data.monthlyUsed} calls`, value: `$${data.computeCost.toFixed(4)}` },
    { label: `Storage · ${data.storageGB} GB`, value: `$${data.storageCost.toFixed(4)}` },
    { label: "Cost per screenshot", value: `$${data.costPerScreenshot.toFixed(6)}`, mono: true },
  ];

  return (
    <ChartCard title="Cost Analysis" subtitle={`Current plan · ${data.plan}`}>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-[var(--dim)]">{r.label}</span>
            <span className={`font-medium ${r.mono ? "font-mono text-xs" : ""}`}>{r.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 rounded-lg bg-[var(--muted)] px-3 py-2.5 text-sm">
          <span className="font-medium">Estimated overage</span>
          <span className="font-semibold" style={{ color: data.totalEstimatedCost > 0 ? WARN : GOOD }}>
            {data.totalEstimatedCost > 0 ? "+" : ""}${data.totalEstimatedCost.toFixed(4)}
          </span>
        </div>
        {data.recommendedPlan && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
            <p className="text-xs text-amber-800 dark:text-amber-300">
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
  const deltaBadge = (delta: number) =>
    `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
      delta > 0
        ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
        : delta < 0
          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          : "bg-[var(--muted)] text-[var(--dim)]"
    }`;
  const arrow = (delta: number) =>
    delta > 0 ? "▲" : delta < 0 ? "▼" : "—";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <ChartCard title="Week over Week">
        <div className="flex items-baseline gap-3">
          <span className="text-[28px] font-semibold leading-none tracking-tight">
            {data.thisWeek.toLocaleString()}
          </span>
          <span className={deltaBadge(data.weekDelta)}>
            {arrow(data.weekDelta)} {data.weekDelta > 0 ? "+" : ""}{data.weekDelta}%
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--dim)]">
          vs {data.lastWeek.toLocaleString()} screenshots last week
        </p>
      </ChartCard>
      <ChartCard title="Month over Month">
        <div className="flex items-baseline gap-3">
          <span className="text-[28px] font-semibold leading-none tracking-tight">
            {data.thisMonth.toLocaleString()}
          </span>
          <span className={deltaBadge(data.monthDelta)}>
            {arrow(data.monthDelta)} {data.monthDelta > 0 ? "+" : ""}{data.monthDelta}%
          </span>
        </div>
        <p className="mt-2 text-xs text-[var(--dim)]">
          vs {data.lastMonth.toLocaleString()} screenshots last month
        </p>
      </ChartCard>
    </div>
  );
}

// ─── Cache Trend ───────────────────────────────────────────────────────

export function CacheTrendChart({ data }: { data: { date: string; rate: number }[] }) {
  if (!data.length) return <ChartCard title="Cache Hit Rate"><Empty text="No data yet" /></ChartCard>;
  return (
    <ChartCard title="Cache Hit Rate" subtitle="Percentage of requests served from cache">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={VIOLET} stopOpacity={0.25} />
              <stop offset="95%" stopColor={VIOLET} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} domain={[0, 100]} axisLine={false} tickLine={false} width={40} unit="%" />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value}%`, "Cache hit rate"]} />
          <Area type="monotone" dataKey="rate" stroke={VIOLET} fill="url(#cg)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Pie Charts ────────────────────────────────────────────────────────

function Donut({ data, colorMap }: { data: { name: string; value: number }[]; colorMap?: Record<string, string> }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%" innerRadius={52} outerRadius={80}
          paddingAngle={3} cornerRadius={4} dataKey="value"
          stroke="none"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={colorMap?.[entry.name] ?? COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [Number(value).toLocaleString(), ""]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function DonutLegend({ data, colorMap }: { data: { name: string; value: number }[]; colorMap?: Record<string, string> }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <ul className="mt-3 space-y-1.5">
      {data.map((d, i) => {
        const pct = Math.round((d.value / total) * 100);
        return (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: colorMap?.[d.name] ?? COLORS[i % COLORS.length] }} />
            <span className="flex-1 truncate capitalize">{d.name.replace(/^(\d)xx$/, "$1xx")}</span>
            <span className="text-[var(--dim)] text-xs">{pct}%</span>
            <span className="font-medium tabular-nums w-16 text-right">{d.value.toLocaleString()}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function EndpointPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartCard title="Endpoint Breakdown"><Empty text="No data yet" /></ChartCard>;
  return (
    <ChartCard title="Endpoint Breakdown" className="min-h-[320px]">
      <Donut data={data} />
      <DonutLegend data={data} />
    </ChartCard>
  );
}

export function FormatPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartCard title="Format Distribution"><Empty text="No screenshots yet" /></ChartCard>;
  return (
    <ChartCard title="Format Distribution" className="min-h-[320px]">
      <Donut data={data} />
      <DonutLegend data={data} />
    </ChartCard>
  );
}

export function StatusPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <ChartCard title="Status Codes"><Empty text="No data yet" /></ChartCard>;
  const sc: Record<string, string> = { "2xx": GOOD, "4xx": WARN, "5xx": BAD };
  return (
    <ChartCard title="Status Codes" className="min-h-[320px]">
      <Donut data={data} colorMap={sc} />
      <DonutLegend data={data} colorMap={sc} />
    </ChartCard>
  );
}

// ─── Bandwidth ─────────────────────────────────────────────────────────

export function BandwidthChart({ data }: { data: { date: string; mb: number }[] }) {
  if (!data.length) return <ChartCard title="Bandwidth Usage"><Empty text="No data yet" /></ChartCard>;
  return (
    <ChartCard title="Bandwidth Usage" subtitle="Total egress per day (MB)">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--muted)" }} formatter={(value) => [`${value} MB`, "Bandwidth"]} />
          <Bar dataKey="mb" fill={ACCENT} radius={[5, 5, 0, 0]} maxBarSize={32} />
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
    inactive: "bg-[var(--muted)] text-[var(--dim)] dark:bg-[var(--muted)] dark:text-[var(--dim)]",
  };

  return (
    <ChartCard title="API Key Health">
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-2.5 px-2 text-xs font-medium text-[var(--dim)] uppercase tracking-wide">Key</th>
              <th className="text-center py-2.5 px-2 text-xs font-medium text-[var(--dim)] uppercase tracking-wide">Health</th>
              <th className="text-right py-2.5 px-2 text-xs font-medium text-[var(--dim)] uppercase tracking-wide">Calls</th>
              <th className="text-right py-2.5 px-2 text-xs font-medium text-[var(--dim)] uppercase tracking-wide">Errors</th>
              <th className="text-right py-2.5 px-2 text-xs font-medium text-[var(--dim)] uppercase tracking-wide">Avg ms</th>
              <th className="text-right py-2.5 px-2 text-xs font-medium text-[var(--dim)] uppercase tracking-wide">P95 ms</th>
              <th className="text-right py-2.5 px-2 text-xs font-medium text-[var(--dim)] uppercase tracking-wide">Calls/day</th>
              <th className="text-right py-2.5 px-2 text-xs font-medium text-[var(--dim)] uppercase tracking-wide">Last used</th>
            </tr>
          </thead>
          <tbody>
            {data.map((k) => (
              <tr key={k.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/40 transition-colors">
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    <span className="text-xs text-[var(--dim)] font-mono">{k.prefix}...</span>
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${healthStyles[k.health] ?? healthStyles.inactive}`}>
                    {k.health}
                  </span>
                </td>
                <td className="py-3 px-2 text-right font-mono tabular-nums">{k.calls.toLocaleString()}</td>
                <td className={`py-3 px-2 text-right font-mono tabular-nums ${k.errors > 0 ? "text-red-500" : ""}`}>{k.errors}</td>
                <td className="py-3 px-2 text-right font-mono tabular-nums">{k.avgLatency}</td>
                <td className="py-3 px-2 text-right font-mono tabular-nums">{k.p95Latency}</td>
                <td className="py-3 px-2 text-right font-mono tabular-nums">{k.callsPerDay}</td>
                <td className="py-3 px-2 text-right text-[var(--dim)] text-xs">
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
  const kpis = [
    { label: "Availability", value: `${data.uptime}%`, tone: data.uptimeMet ? GOOD : BAD, sub: data.uptimeMet ? `≥ ${data.slaTarget}% SLA` : `below ${data.slaTarget}%` },
    { label: "Total requests", value: data.totalRequests.toLocaleString(), tone: SLATE, sub: `${data.errors.toLocaleString()} errors` },
    { label: "Avg latency", value: `${data.avgLatency}ms`, tone: SLATE, sub: "per request" },
    { label: "P99 latency", value: `${data.p99Latency}ms`, tone: data.latencyMet ? GOOD : BAD, sub: data.latencyMet ? "within 5s target" : "exceeds 5s" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.label} className="card p-5 flex flex-col gap-1">
          <span className="text-xs text-[var(--dim)]">{k.label}</span>
          <span className="text-2xl font-semibold tracking-tight tabular-nums" style={{ color: k.tone }}>{k.value}</span>
          <span className="text-xs text-[var(--dim)]">{k.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Smart Upgrade Prompt ──────────────────────────────────────────────

export function UpgradePrompt({ data }: { data: { plan: string; monthlyUsed: number; monthlyLimit: number; recommendedPlan: string | null } }) {
  const usagePct = data.monthlyLimit > 0 ? Math.round((data.monthlyUsed / data.monthlyLimit) * 100) : 0;
  const isFree = data.plan === "free";

  if (!isFree && usagePct < 60 && !data.recommendedPlan) return null;

  const planPrices: Record<string, string> = { starter: "$9/mo", pro: "$49/mo", scale: "$79/mo" };
  const planLimits: Record<string, string> = { starter: "2,500", pro: "15,000", scale: "50,000" };
  const targetPlan = isFree ? "starter" : (data.recommendedPlan ?? "pro");

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="p-2.5 rounded-lg bg-orange-100 dark:bg-orange-900/50">
            <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
              {isFree
                ? "Ready to ship screenshots to users?"
                : usagePct >= 80
                  ? "You're growing fast!"
                  : "Unlock more power"}
            </h3>
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
              {isFree
                ? "Starter ($9) adds full-page, PDF, 2,500 captures/month, and 30-day history."
                : usagePct >= 80
                  ? `You've used ${usagePct}% of your ${data.plan} plan. Upgrade to keep scaling.`
                  : `Upgrade to ${targetPlan} for higher limits and lower per-screenshot costs.`}
            </p>
            <div className="mt-3 flex items-center gap-3 text-sm">
              <span className="font-semibold capitalize">{targetPlan}</span>
              <span className="text-[var(--dim)]">{planPrices[targetPlan]}</span>
              <span className="text-[var(--dim)]">({planLimits[targetPlan]} screenshots/mo)</span>
            </div>
          </div>
        </div>
        {(isFree || usagePct >= 60 || data.recommendedPlan) && (
          <UpgradeButton className="shrink-0 whitespace-nowrap" />
        )}
      </div>
    </div>
  );
}
