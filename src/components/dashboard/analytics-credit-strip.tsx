"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type UsageResp = {
  plan: string;
  entitlements: { rate_limit_per_minute: number };
  period: { reset_at: string | null };
  requests: { used: number; limit: number; remaining: number };
  credits: { used_this_cycle: number; granted_this_cycle: number; balance: number; top_up_balance: number; overage_enabled: boolean };
};

export function AnalyticsCreditStrip({ initial }: { initial: UsageResp | null }) {
  const [usage, setUsage] = useState<UsageResp | null>(initial);
  const [rl, setRl] = useState<{ limit: number; remaining: number; reset: number; limited: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const fetchLive = useCallback(async () => {
    try {
      setErr(null);
      const u = await fetch("/api/v1/usage", { credentials: "include", headers: { accept: "application/json" } });
      if (u.ok) {
        const j = await u.json();
        if (j.success) setUsage(j.data as UsageResp);
      }
      const h = await fetch("/api/v1/screenshots?limit=1", { credentials: "include" });
      const lim = Number(h.headers.get("X-RateLimit-Limit") ?? "");
      const rem = Number(h.headers.get("X-RateLimit-Remaining") ?? "");
      const rst = Number(h.headers.get("X-RateLimit-Reset") ?? "");
      if (!Number.isNaN(lim) && h.headers.get("X-RateLimit-Limit")) {
        setRl({ limit: lim, remaining: rem, reset: rst, limited: h.status === 429 });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, 12000);
    const onVis = () => document.visibilityState === "visible" && fetchLive();
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [fetchLive]);

  if (!usage) return null;

  const totalGranted = (usage.credits.granted_this_cycle ?? 0) + (usage.credits.top_up_balance ?? 0);
  const pct = totalGranted > 0 ? Math.round((usage.credits.used_this_cycle / totalGranted) * 100) : 0;
  const low = pct >= 85 || usage.credits.balance <= 10;
  const limited = rl?.limited || (rl ? rl.remaining <= 0 : false);
  const resetIn = rl ? Math.max(0, Math.ceil((rl.reset - Date.now()) / 1000)) : null;

  return (
    <div className="space-y-3">
      {err && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Live sync note: {err}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`card p-4 ${low ? "border-amber-200 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-950/20" : ""}`}>
          <p className="section-title">Credits consumed</p>
          <p className="metric-value mt-1">{usage.credits.used_this_cycle.toLocaleString()}<span className="text-[11px] font-normal text-[var(--dim)]"> / {totalGranted.toLocaleString()}</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--line)] dark:bg-[var(--muted)]">
            <div className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-[var(--ink)]"}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--dim)]">{pct}% used · <b className="text-[var(--ink)]">{usage.credits.balance.toLocaleString()}</b> left {usage.credits.overage_enabled ? "· overage on" : "· no overage"}</p>
        </div>
        <div className={`card p-4 ${limited ? "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20" : ""}`}>
          <p className="section-title">Rate limit</p>
          <p className={`metric-value mt-1 ${limited ? "text-red-600 dark:text-red-400" : ""}`}>{rl ? `${rl.remaining}/${rl.limit}` : `${usage.requests.remaining}/${usage.requests.limit}`}</p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            {rl ? (limited ? `Limited · retry in ${resetIn}s` : `Resets in ${resetIn}s`) : `${usage.entitlements.rate_limit_per_minute}/min plan`}
            {limited && " · Playground & API share window"}
          </p>
        </div>
        <div className="card p-4">
          <p className="section-title">Monthly usage</p>
          <p className="metric-value mt-1">{usage.requests.used.toLocaleString()}<span className="text-[11px] font-normal text-[var(--dim)]"> / {usage.requests.limit.toLocaleString()}</span></p>
          <p className="mt-1 text-xs text-[var(--dim)]">{usage.requests.remaining.toLocaleString()} left · {usage.period.reset_at ? `resets ${new Date(usage.period.reset_at).toLocaleDateString()}` : "no reset"}</p>
        </div>
        <div className="card p-4">
          <p className="section-title">Sources — live</p>
          <p className="mt-1 text-sm font-medium">API + Playground + History</p>
          <p className="mt-1 text-xs text-[var(--dim)]">Credits debited via <code className="rounded bg-[var(--muted)] px-1">/api/take</code> · <code className="rounded bg-[var(--muted)] px-1">/api/v1/screenshots</code> · cached hits show in History.</p>
          <div className="mt-2 flex gap-1">
            <Link href="/dashboard/playground" className="text-xs font-medium underline">Playground →</Link>
            <span className="text-[var(--line)]">·</span>
            <Link href="/dashboard/history" className="text-xs font-medium underline">History →</Link>
            <span className="text-[var(--line)]">·</span>
            <Link href="/dashboard" className="text-xs font-medium underline">Dashboard →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
