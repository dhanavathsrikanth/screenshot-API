"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const RANGES = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
] as const;

export function AnalyticsControls({ initialDays = "30" }: { initialDays?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();
  const active = sp.get("days") ?? initialDays;

  function setDays(v: string) {
    const params = new URLSearchParams(sp.toString());
    params.set("days", v);
    startTransition(() => router.push(`?${params.toString()}`));
  }

  function handleRefresh() {
    startTransition(() => router.refresh());
  }

  function handleExport() {
    window.location.href = `/api/analytics/export?days=${active}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] p-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setDays(r.value)}
            disabled={pending}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              active === r.value
                ? "bg-[var(--ink)] text-white dark:bg-white dark:text-black"
                : "text-[var(--dim)] hover:text-[var(--ink)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleRefresh}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] disabled:opacity-50"
      >
        <svg className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        Refresh
      </button>

      <button
        onClick={handleExport}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 12.75v-3m0 0l-2.25-2.25M12 12.75l2.25-2.25" />
        </svg>
        Export
      </button>

      <a
        href="/docs"
        className="hidden sm:inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]"
      >
        Docs
      </a>
    </div>
  );
}

export function AnalyticsActionBar() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <a href="/dashboard/history" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 font-medium hover:bg-[var(--muted)]">
        View history
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
      </a>
      <a href="/dashboard/api-keys" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 font-medium hover:bg-[var(--muted)]">
        Manage keys
      </a>
      <a href="/dashboard/plan" className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-medium text-[var(--dim)] hover:text-[var(--ink)]">
        Billing
      </a>
    </div>
  );
}
