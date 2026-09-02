"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type UsageData = {
  plan: string;
  entitlements: { rate_limit_per_minute: number };
  period: { start: string; end: string; reset_at: string | null };
  requests: { used: number; limit: number; remaining: number };
  credits: { used_this_cycle: number; granted_this_cycle: number; balance: number; top_up_balance: number; overage_enabled: boolean };
  requests_this_window: { total: number; cached: number; cache_hit_rate: number };
};

type RateLimitLive = {
  limit: number;
  remaining: number;
  reset: number;
  retryAfterMs: number;
  allowed: boolean;
};

type RecentItem = {
  id: string;
  url: string;
  format: string;
  width: number;
  height: number;
  cached: boolean;
  created_at: string;
  storage_url?: string | null;
};

export function DashboardLive({
  initialUsage,
  initialRateLimit,
  userId,
  onRefresh,
}: {
  initialUsage: UsageData | null;
  initialRateLimit: RateLimitLive | null;
  userId: string;
  onRefresh?: () => void;
}) {
  const [usage, setUsage] = useState<UsageData | null>(initialUsage);
  const [rateLimit, setRateLimit] = useState<RateLimitLive | null>(initialRateLimit);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [polling, setPolling] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);

  const fetchUsage = useCallback(async () => {
    try {
      setPolling(true);
      setError(null);
      // Primary: /api/v1/usage (api-key OR Clerk session). Falls back to server snapshot if 401.
      const res = await fetch("/api/v1/usage", { credentials: "include", headers: { accept: "application/json" } });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setUsage(json.data as UsageData);
        }
      } else if (res.status !== 401) {
        const j = await res.json().catch(() => null);
        if (j?.error?.message) setError(j.error.message);
      }
      // Rate-limit probe: hit /api/v1/screenshots HEAD-equivalent without creating job — use GET with limit=1 to read headers
      const probe = await fetch("/api/v1/screenshots?limit=1", { credentials: "include" });
      const headers = probe.headers;
      const limit = Number(headers.get("X-RateLimit-Limit") ?? usage?.entitlements.rate_limit_per_minute ?? rateLimit?.limit ?? 0);
      const remaining = Number(headers.get("X-RateLimit-Remaining") ?? rateLimit?.remaining ?? 0);
      const reset = Number(headers.get("X-RateLimit-Reset") ?? rateLimit?.reset ?? 0);
      const retryAfter = Number(headers.get("Retry-After") ?? 0) * 1000;
      if (headers.get("X-RateLimit-Limit")) {
        const isLimited = probe.status === 429;
        setRateLimit({
          limit: Number.isFinite(limit) ? limit : 0,
          remaining: Number.isFinite(remaining) ? remaining : 0,
          reset: Number.isFinite(reset) ? reset : Date.now() + 60000,
          retryAfterMs: isLimited ? (retryAfter || 60000) : 0,
          allowed: !isLimited,
        });
        if (isLimited) setCountdown(Math.ceil((retryAfter || 60000) / 1000));
      }
      // Recent captures via history pagination action — also try client fetch fallback
      try {
        const h = await fetch("/api/v1/screenshots?limit=5", { credentials: "include" });
        if (h.ok) {
          const hj = await h.json();
          if (hj.success && Array.isArray(hj.data?.screenshots)) {
            const mapped: RecentItem[] = hj.data.screenshots.slice(0, 5).map((s: { id: string; screenshot?: { format?: string; width?: number; height?: number; url?: string }; status: string; created_at: string }) => ({
              id: s.id,
              url: s.screenshot?.url ?? s.id,
              format: s.screenshot?.format ?? "png",
              width: s.screenshot?.width ?? 0,
              height: s.screenshot?.height ?? 0,
              cached: false,
              created_at: s.created_at,
              storage_url: s.screenshot?.url ?? null,
            }));
            // only keep completed
            const completed = hj.data.screenshots.filter((s: { status: string }) => s.status === "completed").slice(0,5);
            if (completed.length) {
              setRecent(mapped.filter((_, i) => hj.data.screenshots[i]?.status === "completed"));
            }
          }
        }
      } catch {}

      setLastUpdated(new Date());
      onRefresh?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPolling(false);
    }
  }, [onRefresh, rateLimit?.limit, rateLimit?.remaining, rateLimit?.reset, usage?.entitlements.rate_limit_per_minute]);

  // Poll every 12s when autoPoll enabled, plus on visibility return
  useEffect(() => {
    if (!autoPoll) return;
    const id = setInterval(fetchUsage, 12000);
    const onVis = () => { if (document.visibilityState === "visible") fetchUsage(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", fetchUsage);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", fetchUsage); };
  }, [autoPoll, fetchUsage]);

  // Countdown timer for ratelimit
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  // Initial recent load via server-provided history not yet — fetch once on mount
  useEffect(() => { fetchUsage(); }, [fetchUsage]);

  const creditsUsed = usage?.credits.used_this_cycle ?? 0;
  const creditsGranted = usage?.credits.granted_this_cycle ?? 0;
  const creditsBalance = usage?.credits.balance ?? 0;
  const topUp = usage?.credits.top_up_balance ?? 0;
  const totalGranted = creditsGranted + topUp;
  const creditsPct = totalGranted > 0 ? Math.round((creditsUsed / totalGranted) * 100) : 0;
  const requestsUsed = usage?.requests.used ?? 0;
  const requestsLimit = usage?.requests.limit ?? 0;
  const resetAt = usage?.period.reset_at ? new Date(usage.period.reset_at) : null;
  const daysLeft = resetAt ? Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / (24*60*60*1000))) : null;

  const isLimited = rateLimit ? !rateLimit.allowed || rateLimit.remaining <= 0 : false;
  const resetInSec = rateLimit ? Math.max(0, Math.ceil((rateLimit.reset - Date.now()) / 1000)) : 0;

  return (
    <div className="space-y-4">
      {/* Live header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${isLimited ? "bg-red-500 animate-pulse" : polling ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
          <div>
            <p className="text-xs font-semibold text-[var(--ink)]">
              {isLimited ? `Rate limited — retry in ${countdown || resetInSec}s` : polling ? "Syncing…" : "Live"} · {autoPoll ? "auto-refresh 12s" : "paused"}
            </p>
            <p className="text-[11px] text-[var(--dim)]">
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · ` : ""}
              {isLimited && rateLimit ? `Remaining ${rateLimit.remaining}/${rateLimit.limit}` : creditsBalance.toLocaleString() + " credits left"}
              {daysLeft !== null ? ` · ${daysLeft}d until reset` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--dim)] cursor-pointer">
            <input type="checkbox" checked={autoPoll} onChange={(e) => setAutoPoll(e.target.checked)} className="h-3.5 w-3.5 rounded border-[var(--border)]" />
            Auto
          </label>
          <button
            onClick={fetchUsage}
            disabled={polling}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"
          >
            {polling ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--dim)] border-t-transparent" />
                Refreshing…
              </>
            ) : (
              "Refresh now"
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Sync note: {error}
        </p>
      )}

      {/* Rate limit banner when limited */}
      {isLimited && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/20">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">Rate limited — you hit {rateLimit?.limit}/min</p>
          <p className="mt-1 text-xs text-red-700 dark:text-red-400">
            Try again in <span className="font-mono font-semibold">{countdown || resetInSec}s</span> · limit resets at {rateLimit ? new Date(rateLimit.reset).toLocaleTimeString() : "—"} · remaining {rateLimit?.remaining ?? 0}
          </p>
          <div className="mt-3 flex gap-2">
            <Link href="/dashboard/playground" className="text-xs font-medium underline text-red-800 dark:text-red-300">Retry in Playground →</Link>
            <Link href="/dashboard/plan" className="text-xs text-red-700 dark:text-red-400 underline">Upgrade for higher limit</Link>
          </div>
        </div>
      )}

      {/* Credits consumed + ratelimit detail grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Credits — consumed vs remaining</h3>
            <span className="text-[11px] text-[var(--dim)]">{creditsPct}% used</span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{creditsUsed.toLocaleString()}</span>
              <span className="text-sm text-[var(--dim)]">used</span>
              <span className="mx-1 text-[var(--line)]">/</span>
              <span className="text-sm text-[var(--dim)]">{totalGranted.toLocaleString()} granted</span>
              <span className="ml-auto rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium">{creditsBalance.toLocaleString()} left</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--line)] dark:bg-[var(--muted)]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, creditsPct)}%`, background: creditsPct >= 90 ? "#ef4444" : creditsPct >= 75 ? "#f59e0b" : "var(--ink)" }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dim)]">
              <span>Balance: <b className="text-[var(--ink)]">{creditsBalance.toLocaleString()}</b></span>
              <span>Top-up: <b className="text-[var(--ink)]">{topUp.toLocaleString()}</b></span>
              <span>Overage: {usage?.credits.overage_enabled ? "enabled" : "off"}</span>
              <span>Requests: <b className="text-[var(--ink)]">{requestsUsed.toLocaleString()}/{requestsLimit.toLocaleString()}</b></span>
              {resetAt && <span>Resets {resetAt.toLocaleDateString()}</span>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link href="/dashboard/billing" className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 font-medium hover:bg-[var(--muted)]">Billing →</Link>
            <Link href="/dashboard/plan" className="rounded-full bg-[var(--ink)] px-3 py-1.5 font-medium text-white hover:opacity-90 dark:bg-white dark:text-black">Get more credits</Link>
            <Link href="/docs" className="px-3 py-1.5 text-[var(--dim)] hover:text-[var(--ink)]">How credits work</Link>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Rate limit — per minute</h3>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-3xl font-semibold tracking-tight tabular-nums ${isLimited ? "text-red-600 dark:text-red-400" : "text-[var(--ink)]"}`}>
              {rateLimit ? `${rateLimit.remaining}` : "—"}
            </span>
            <span className="text-sm text-[var(--dim)]">/ {rateLimit?.limit ?? usage?.entitlements.rate_limit_per_minute ?? "—"} left</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--line)] dark:bg-[var(--muted)]">
            <div
              className={`h-full rounded-full transition-all ${isLimited ? "bg-red-500" : "bg-emerald-500"}`}
              style={{ width: rateLimit?.limit ? `${Math.max(0, Math.min(100, (rateLimit.remaining / rateLimit.limit) * 100))}%` : "0%" }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--dim)]">
            {rateLimit ? (
              isLimited ? `Limited for ${countdown || resetInSec}s — Retry-After ${Math.ceil((rateLimit.retryAfterMs || resetInSec*1000)/1000)}s` : `Resets in ${resetInSec}s · ${new Date(rateLimit.reset).toLocaleTimeString()}`
            ) : (
              "Rate info loads after your first API or playground call"
            )}
          </p>
          <div className="mt-3 rounded-lg bg-[var(--muted)]/60 px-3 py-2 text-[11px] leading-relaxed text-[var(--dim)]">
            Playground and <code className="rounded bg-white px-1 dark:bg-[var(--card)]">/api/v1/screenshots</code> share the same window. Bulk bypasses single-call limit but still deducts credits per URL.
          </div>
        </div>
      </div>

      {/* Recent captures from history + v1 API */}
      {recent.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Recent captures — from History & API</h3>
            <Link href="/dashboard/history" className="text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)]">View all →</Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/history`}
                className="group rounded-xl border border-[var(--border)] overflow-hidden hover:border-[var(--ink)]/20 transition"
                title={r.url}
              >
                <div className="aspect-[16/10] bg-[var(--muted)] flex items-center justify-center overflow-hidden text-[11px] text-[var(--dim)]">
                  {r.storage_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.storage_url} alt={r.url} className="h-full w-full object-cover group-hover:scale-[1.02] transition" loading="lazy" />
                  ) : (
                    <span className="px-2 text-center truncate">{r.format.toUpperCase()} · {r.id.slice(0,8)}</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{r.url.length > 32 ? r.url.slice(0,32) + "…" : r.url}</p>
                  <p className="text-[11px] text-[var(--dim)]">{r.format.toUpperCase()} · {new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
