import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getProject } from "@/app/actions/projects";
import {
  getProjectSummaryStats,
  getProjectDailyUsage,
  getProjectLatencyStats,
} from "@/app/actions/project-analytics";
import { getScreenshotHistory } from "@/app/actions/usage";
import { UsageChart, LatencyChart } from "@/components/dashboard/charts";

const PALETTES = [
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", accent: "bg-amber-500" },
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", accent: "bg-sky-500" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", accent: "bg-emerald-500" },
  { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", accent: "bg-violet-500" },
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", accent: "bg-rose-500" },
  { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", accent: "bg-slate-600" },
];
function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="section-title">{label}</p>
      <p className="metric-value mt-1" style={{ color: tone ?? "var(--ink)" }}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--dim)]">{hint}</p>
    </div>
  );
}

export default async function WorkspaceDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { id: projectId } = await params;

  const project = await getProject(userId, projectId);
  if (!project) notFound();

  const pal = paletteFor(project.name);
  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  const [summary, daily, latency, recent] = await Promise.all([
    safe(() => getProjectSummaryStats(userId, projectId), {
      totalRequests: 0, avgLatency: 0, p99Latency: 0, cacheHitRate: 0, errorRate: 0,
      apiKeyCount: project.api_key_count ?? 0, screenshotCount: project.screenshot_count ?? 0, webhookCount: project.webhook_count ?? 0, usage30d: project.usage_30d ?? 0,
    }),
    safe(() => getProjectDailyUsage(userId, projectId), [] as { date: string; count: number; ma7: number }[]),
    safe(() => getProjectLatencyStats(userId, projectId), [] as { date: string; avg: number; p50: number; p95: number; p99: number }[]),
    safe(() => getScreenshotHistory(userId, { limit: 6, filters: { projectId } }), [] as any[]),
  ]);

  const workspaceNav = [
    { href: `/dashboard/projects/${projectId}`, label: "Overview", active: true },
    { href: `/dashboard/projects/${projectId}/analytics`, label: "Analytics" },
    { href: `/dashboard/history?project=${projectId}`, label: "History" },
    { href: `/dashboard/api-keys?project=${projectId}`, label: "API Keys" },
    { href: `/dashboard/webhooks?project=${projectId}`, label: "Webhooks" },
    { href: `/dashboard/storage?project=${projectId}`, label: "Storage" },
    { href: `/dashboard/playground?project=${projectId}`, label: "Playground" },
  ];

  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[var(--dim)]">
        <Link href="/dashboard/projects" className="inline-flex items-center gap-1 hover:text-[var(--ink)]">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
          Projects
        </Link>
        <span className="text-[var(--border)]">/</span>
        <span className="font-medium text-[var(--ink)] truncate">{project.name}</span>
        <span className="hidden sm:inline-flex items-center rounded-full bg-[var(--muted)] px-2 py-0.5 font-mono text-[11px]">{project.slug ?? project.id.slice(0, 8)}</span>
        <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${ (summary.usage30d ?? 0) > 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300" : "bg-[var(--muted)] text-[var(--dim)]"}`}>{(summary.usage30d ?? 0) > 0 ? "● Active" : "○ Idle"}</span>
      </div>

      {/* workspace hero — distinct from global dashboard */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className={`absolute top-0 left-0 right-0 h-1 ${pal.accent} opacity-80`} />
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.05] via-transparent to-violet-500/[0.04] pointer-events-none" />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ${pal.bg} ${pal.text}`}>{initials(project.name)}</span>
              <div className="min-w-0">
                <p className="eyebrow text-orange-600">Workspace</p>
                <h1 className="text-[22px] font-semibold tracking-tight truncate">{project.name}</h1>
                <p className="text-xs text-[var(--dim)] mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono">{project.slug ?? project.id.slice(0, 8)}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span>{summary.apiKeyCount} keys · {summary.screenshotCount} screenshots · {summary.webhookCount} webhooks</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href={`/dashboard/projects/${projectId}/analytics`} className="btn-primary px-3 py-2 text-xs">Analytics →</Link>
              <Link href={`/dashboard/history?project=${projectId}`} className="btn-secondary px-3 py-2 text-xs">History</Link>
              <Link href={`/dashboard/api-keys?project=${projectId}`} className="btn-secondary px-3 py-2 text-xs">Keys</Link>
            </div>
          </div>

          {/* workspace sub-nav — the “separate dashboard” nav */}
          <nav className="mt-5 flex gap-1 overflow-auto rounded-xl bg-[var(--muted)]/60 p-1 border border-[var(--border)]">
            {workspaceNav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${n.active ? "bg-[var(--card)] text-[var(--ink)] shadow-sm border border-[var(--border)]" : "text-[var(--dim)] hover:text-[var(--ink)] hover:bg-[var(--card)]/60"}`}
              >
                {n.label}
              </Link>
            ))}
            <Link href="/dashboard/projects" className="ml-auto whitespace-nowrap rounded-lg px-3 py-1.5 text-xs text-[var(--dim)] hover:text-[var(--ink)]">← All workspaces</Link>
          </nav>
        </div>
      </div>

      {/* scoped KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Requests 30d" value={summary.totalRequests.toLocaleString()} hint="scoped to this workspace" />
        <Stat label="Avg latency" value={`${summary.avgLatency}ms`} hint="per request" />
        <Stat label="P99 latency" value={`${summary.p99Latency}ms`} hint="99th percentile" tone={summary.p99Latency > 5000 ? "#ef4444" : "#10b981"} />
        <Stat label="Cache hit" value={`${summary.cacheHitRate}%`} hint="served from cache" tone={summary.cacheHitRate >= 50 ? "#10b981" : "#f59e0b"} />
        <Stat label="Error rate" value={`${summary.errorRate.toFixed(2)}%`} hint="non-2xx" tone={summary.errorRate === 0 ? "#10b981" : "#f59e0b"} />
        <Stat label="API keys" value={String(summary.apiKeyCount)} hint={`${summary.screenshotCount} screenshots`} />
      </div>

      {/* charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <UsageChart data={daily} />
        <LatencyChart data={latency} />
      </div>

      {/* recent + quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="panel-heading">Recent captures</h3>
            <Link href={`/dashboard/history?project=${projectId}`} className="text-xs font-medium text-orange-600 hover:underline">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-6 text-center">
              <p className="text-sm font-medium">No captures yet in this workspace</p>
              <p className="mt-1 text-xs text-[var(--dim)]">Use Playground or API with a key scoped to “{project.name}”.</p>
              <Link href={`/dashboard/playground?project=${projectId}`} className="btn-primary mt-3 inline-flex text-xs">Open Playground</Link>
            </div>
          ) : (
            <div className="mt-3 divide-y divide-[var(--border)]">
              {recent.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.url ?? r.screenshot_url ?? "capture"}</p>
                    <p className="text-xs text-[var(--dim)]">{r.created_at ? new Date(r.created_at).toLocaleString() : ""} · {r.format ?? "png"} · {r.cached ? "cached" : "fresh"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${r.status_code && r.status_code >= 400 ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>{r.status_code ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <h3 className="panel-heading">Workspace actions</h3>
            <div className="mt-3 grid gap-2">
              <Link href={`/dashboard/api-keys?project=${projectId}`} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5 hover:bg-[var(--muted)] transition-colors">
                <span className="text-sm font-medium">Manage API keys</span><span className="text-xs text-[var(--dim)]">{summary.apiKeyCount} →</span>
              </Link>
              <Link href={`/dashboard/webhooks?project=${projectId}`} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5 hover:bg-[var(--muted)] transition-colors">
                <span className="text-sm font-medium">Webhooks</span><span className="text-xs text-[var(--dim)]">{summary.webhookCount} →</span>
              </Link>
              <Link href={`/dashboard/storage?project=${projectId}`} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5 hover:bg-[var(--muted)] transition-colors">
                <span className="text-sm font-medium">Storage</span><span className="text-xs text-[var(--dim)]">S3 / R2 / GCS →</span>
              </Link>
              <Link href={`/dashboard/projects/${projectId}/analytics`} className="flex items-center justify-between rounded-xl bg-[var(--ink)] px-3 py-2.5 text-white hover:opacity-90 transition-opacity">
                <span className="text-sm font-medium">Full analytics</span><span className="text-xs opacity-70">→</span>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--dim)]">Isolation</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">Keys, history, webhooks & storage for “<span className="font-medium text-[var(--ink)]">{project.name}</span>” are fully isolated. Switch workspaces from the sidebar — data never leaks between them (enforced by <span className="font-mono">project_id</span> + RLS).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
