"use client";

import { useEffect, useState } from "react";

type CheckStatus = "ok" | "degraded" | "down";

type HealthData = {
  status: "ok" | "error";
  service: string;
  checks: Record<string, boolean>;
  timestamp: string;
};

const checkLabels: Record<string, string> = {
  redis: "Caching & rate limiting",
  supabase: "Database & storage",
  storage: "Screenshot object storage",
};

export function StatusChecks({ initial }: { initial: HealthData }) {
  const [data, setData] = useState<HealthData>(initial);
  const [lastError, setLastError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLastError(false);
        }
      } catch {
        if (!cancelled) setLastError(true);
      }
      if (!cancelled) timer = setTimeout(poll, 30000);
    };

    timer = setTimeout(poll, 30000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const allUp = data.status === "ok" && Object.values(data.checks).every(Boolean);
  const overall: CheckStatus = lastError ? "down" : allUp ? "ok" : "degraded";

  const statusStyles: Record<CheckStatus, { dot: string; badge: string; label: string }> = {
    ok: { dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", label: "Operational" },
    degraded: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Degraded" },
    down: { dot: "bg-red-500", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Down" },
  };

  const style = statusStyles[overall];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`relative flex h-3 w-3 ${overall === "down" ? "" : ""}`}>
              {allUp && (
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${style.dot} opacity-60`} />
              )}
              <span className={`relative inline-flex h-3 w-3 rounded-full ${style.dot}`} />
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">ScreenshotAPI Status</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">All checks verified server-side</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${style.badge}`}>
            {style.label}
          </span>
        </div>

        <ul className="mt-6 space-y-3">
          {Object.entries(data.checks).map(([key, healthy]) => {
            const ok = healthy && !lastError;
            return (
              <li key={key} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span className="text-sm font-medium text-zinc-900 dark:text-white">
                    {checkLabels[key] ?? key}
                  </span>
                  <code className="hidden rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 sm:inline">
                    {key}
                  </code>
                </div>
                <span className={`text-xs font-medium ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {ok ? "Operational" : "Unavailable"}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Refreshes automatically every 30 seconds</span>
          <span className="font-mono">
            {lastError ? "Last check: unreachable" : `Last checked ${new Date(data.timestamp).toLocaleTimeString()}`}
          </span>
        </div>
      </div>
    </div>
  );
}
