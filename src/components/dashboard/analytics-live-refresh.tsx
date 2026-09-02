"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export function AnalyticsLiveRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [last, setLast] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    router.refresh();
    setLast(new Date());
    setTick((t) => t + 1);
  }, [router]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(refresh, intervalMs);
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", refresh); };
  }, [auto, intervalMs, refresh]);

  // countdown until next refresh
  const [countdown, setCountdown] = useState(intervalMs / 1000);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? intervalMs / 1000 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [auto, intervalMs, tick]);
  useEffect(() => { setCountdown(intervalMs / 1000); }, [intervalMs, tick]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${auto ? "bg-emerald-500 animate-pulse" : "bg-[var(--dim)]"}`} />
        <div>
          <p className="text-xs font-semibold text-[var(--ink)]">
            {auto ? `Live · refreshes in ${Math.ceil(countdown)}s` : "Paused"} · {intervalMs / 1000}s
          </p>
          <p className="text-[11px] text-[var(--dim)]">
            {last ? `Last sync ${last.toLocaleTimeString()}` : "Waiting for first sync"} · data from API · History · Playground
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="h-3.5 w-3.5 rounded border-[var(--border)]" />
          Auto
        </label>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
        >
          Refresh now
        </button>
      </div>
    </div>
  );
}
