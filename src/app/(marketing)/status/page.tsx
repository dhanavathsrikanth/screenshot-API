import { Suspense } from "react";
import type { Metadata } from "next";
import { StatusChecks } from "@/components/status-checks";

export const metadata: Metadata = {
  title: "Status — ScreenshotAPI",
  description: "Live status of the ScreenshotAPI service: caching, database, and object storage checks.",
};

type HealthData = {
  status: "ok" | "error";
  service: string;
  checks: Record<string, boolean>;
  timestamp: string;
};

async function fetchHealth(): Promise<HealthData> {
  try {
    const base = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    const json = await res.json();
    return json.status === "ok"
      ? json
      : { status: "error", service: "screenshotapi", checks: json.checks ?? {}, timestamp: new Date().toISOString() };
  } catch {
    return {
      status: "error",
      service: "screenshotapi",
      checks: { redis: false, supabase: false, storage: false },
      timestamp: new Date().toISOString(),
    };
  }
}

export default async function StatusPage() {
  const health = await fetchHealth();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-medium text-zinc-500 dark:bg-slate-900 dark:text-zinc-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live status
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-5xl">
          Service Status
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Real-time health of the services that power every screenshot: caching, rate limiting, the
          database, and object storage.
        </p>
      </div>

      <Suspense fallback={<div className="text-center text-sm text-zinc-500">Loading checks…</div>}>
        <StatusChecks initial={health} />
      </Suspense>

      <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-[var(--border)] bg-white p-6 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Uptime history</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This page reflects live checks of the runtime dependencies. For historical SLA metrics,
          reliability trends, and incident details, sign in and visit the{" "}
          <a href="/dashboard/analytics" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Analytics dashboard
          </a
          >.
        </p>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Programmatic monitoring can use the{" "}
          <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">
            GET /api/health
          </code>{" "}
          endpoint, which returns <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">200</code>{" "}
          with a <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">checks</code> object, or{" "}
          <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">503</code> when any dependency is
          unhealthy.
        </p>
      </div>
    </div>
  );
}
