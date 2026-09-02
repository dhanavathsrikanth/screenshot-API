import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getScreenshotHistory, getScreenshotHistoryStats } from "@/app/actions/usage";
import type { ScreenshotRow } from "@/lib/history-types";
import { PageHeader } from "@/components/dashboard/page-header";
import { HistoryBrowser, type HistoryError } from "@/components/dashboard/history-browser";
import { DataAccessBanner } from "@/components/dashboard/data-access-banner";
import { verifyProjectOwnership } from "@/app/actions/projects";
import Link from "next/link";

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { project: projectId } = await searchParams;

  if (projectId) {
    const owned = await verifyProjectOwnership(userId, projectId);
    if (!owned) notFound();
  }

  let initialRows: ScreenshotRow[] = [];
  let initialError: HistoryError | null = null;
  let stats = { total: 0, totalBytes: 0, viaApi: 0, cachedCount: 0 };

  try {
    [initialRows, stats] = await Promise.all([
      getScreenshotHistory(userId, {
        limit: 50,
        filters: projectId ? { projectId } : undefined,
      }),
      getScreenshotHistoryStats(userId),
    ]);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const lower = message.toLowerCase();
    const authRelated =
      lower.includes("jwt") ||
      lower.includes("not authenticated") ||
      lower.includes("unauthorized") ||
      lower.includes("invalid claim");
    initialError = {
      message,
      code: (e as Error & { code?: string }).code,
      issue: authRelated ? "clerk_supabase_mismatch" : "database_error",
    };
  }

  const apiPct = stats.total > 0 ? Math.round((stats.viaApi / stats.total) * 100) : 0;
  const cachedPct = stats.total > 0 ? Math.round((stats.cachedCount / stats.total) * 100) : 0;

  const isWorkspace = !!projectId;

  return (
    <>
      {isWorkspace && (
        <div className="flex items-center gap-2 text-xs text-[var(--dim)]">
          <Link href="/dashboard/projects" className="hover:text-[var(--ink)]">Projects</Link>
          <span className="text-[var(--border)]">/</span>
          <Link href={`/dashboard/projects/${projectId}`} className="hover:text-[var(--ink)]">Workspace</Link>
          <span className="text-[var(--border)]">/</span>
          <span className="font-medium text-[var(--ink)]">History</span>
          <Link href={`/dashboard/projects/${projectId}`} className="ml-auto hidden sm:inline-flex rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs hover:bg-[var(--muted)]">← Workspace</Link>
        </div>
      )}
      <PageHeader
        eyebrow={isWorkspace ? "Workspace · History" : "History"}
        title="Screenshot History"
        description={isWorkspace ? "Scoped to this workspace — only screenshots from this project’s keys are shown." : "Every screenshot captured from the playground and API calls."}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total captures", value: stats.total.toLocaleString() },
          { label: "Storage used", value: formatBytes(stats.totalBytes) },
          { label: "Via API", value: `${apiPct}%` },
          { label: "Cache hits", value: `${cachedPct}%` },
        ].map((item) => (
          <div key={item.label} className="card p-4">
            <p className="section-title">{item.label}</p>
            <p className="metric-value mt-1 text-[var(--ink)]">{item.value}</p>
          </div>
        ))}
      </div>

      {initialError && (
        <DataAccessBanner
          status={{
            ok: false,
            issue: initialError.issue ?? "database_error",
            message: initialError.message,
          }}
          title="Unable to load history"
        />
      )}

      <HistoryBrowser
        initialRows={initialRows}
        initialError={initialError}
        initialProjectId={projectId}
      />
    </>
  );
}