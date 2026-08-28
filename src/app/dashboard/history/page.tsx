import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getScreenshotHistory, getScreenshotHistoryStats } from "@/app/actions/usage";
import type { ScreenshotRow } from "@/lib/history-types";
import { PageHeader } from "@/components/dashboard/page-header";
import { HistoryBrowser } from "@/components/dashboard/history-browser";

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default async function HistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let initialRows: ScreenshotRow[] = [];
  let stats = { total: 0, totalBytes: 0, viaApi: 0, cachedCount: 0 };
  try {
    [initialRows, stats] = await Promise.all([
      getScreenshotHistory(userId, { limit: 50 }),
      getScreenshotHistoryStats(userId),
    ]);
  } catch {
    // leave defaults — empty state renders
  }

  const apiPct = stats.total > 0 ? Math.round((stats.viaApi / stats.total) * 100) : 0;
  const cachedPct = stats.total > 0 ? Math.round((stats.cachedCount / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="History"
        title="Screenshot History"
        description="Every screenshot captured from the playground and API calls."
      />

      {stats.total > 0 ? (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total captures", value: stats.total.toLocaleString() },
              { label: "Storage used", value: formatBytes(stats.totalBytes) },
              { label: "Via API", value: `${apiPct}%` },
              { label: "Cache hits", value: `${cachedPct}%` },
            ].map((item) => (
              <div key={item.label} className="card p-4">
                <p className="eyebrow text-zinc-400">{item.label}</p>
                <p className="mt-1 text-xl font-semibold tracking-tight">{item.value}</p>
              </div>
            ))}
          </div>

          <HistoryBrowser initialRows={initialRows} />
        </>
      ) : (
        <div className="card border-dashed p-12 text-center">
          <div className="text-zinc-400 mb-3">
            <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500 mb-1">No screenshots yet</p>
          <p className="text-xs text-zinc-400 mb-4">
            Use the playground or make an API call to get started.
          </p>
          <Link href="/dashboard/playground" className="btn-primary">
            Try the Playground
          </Link>
        </div>
      )}
    </div>
  );
}
