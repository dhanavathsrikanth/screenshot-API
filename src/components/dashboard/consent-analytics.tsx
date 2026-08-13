"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type TrendPoint = { date: string; impression: number; accept: number; reject: number };
type Summary = {
  totals: { impression: number; accept: number; reject: number };
  acceptanceRate: number;
  trend: TrendPoint[];
} | null;

export function ConsentAnalytics({ summary }: { summary: Summary }) {
  if (!summary) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-2">Cookie Consent</h2>
        <p className="text-sm text-zinc-400">
          No consent data yet. Apply migration 010 and the cookie banner will
          start recording impression / accept / essential-only events here.
        </p>
      </div>
    );
  }

  const cards = [
    { label: "Banner impressions (30d)", value: summary.totals.impression.toLocaleString() },
    { label: "Accepted (30d)", value: summary.totals.accept.toLocaleString() },
    { label: "Essential only (30d)", value: summary.totals.reject.toLocaleString() },
    { label: "Acceptance rate", value: `${summary.acceptanceRate}%` },
  ];

  const hasData = summary.trend.some((t) => t.impression + t.accept + t.reject > 0);

  return (
    <section className="space-y-4">
      <h2 className="eyebrow text-zinc-500">Cookie Consent</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5">
            <div className="text-2xl font-bold">{card.value}</div>
            <div className="text-xs text-zinc-400 mt-1">{card.label}</div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
          Last 14 Days
        </h3>
        {hasData ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summary.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#a1a1aa" }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11, fill: "#a1a1aa" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                }}
              />
              <Legend />
              <Bar dataKey="impression" name="Impressions" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="accept" name="Accepted" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reject" name="Essential only" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-sm text-zinc-400">
            No events recorded yet
          </div>
        )}
      </div>
    </section>
  );
}
