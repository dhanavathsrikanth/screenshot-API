import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getScreenshotHistory } from "@/app/actions/usage";

type Screenshot = {
  id: string;
  url: string;
  storage_url: string | null;
  format: string;
  width: number;
  height: number;
  file_size_bytes: number | null;
  cached: boolean;
  created_at: string;
};

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
};

export default async function HistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let screenshots: Screenshot[] = [];
  try {
    screenshots = await getScreenshotHistory(userId, 50);
  } catch {
    screenshots = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Your latest rendered screenshots.
        </p>
      </div>

      {screenshots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <div className="text-zinc-400 mb-3">
            <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
          <p className="text-sm text-zinc-500 mb-1">No screenshots yet</p>
          <p className="text-xs text-zinc-400 mb-4">
            Use the playground or make an API call to get started.
          </p>
          <Link
            href="/dashboard/playground"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
            Try the Playground
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {screenshots.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-[var(--border)] p-4 flex items-center gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex-shrink-0 w-16 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                {s.storage_url ? (
                  <img
                    src={s.storage_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-medium text-zinc-400 uppercase">
                    {s.format}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate font-medium" title={s.url}>
                  {s.url}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                  <span className="font-mono">{s.width}x{s.height}</span>
                  <span>&middot;</span>
                  <span>{s.format.toUpperCase()}</span>
                  <span>&middot;</span>
                  <span>{formatBytes(s.file_size_bytes)}</span>
                  {s.cached && (
                    <>
                      <span>&middot;</span>
                      <span className="text-green-600 dark:text-green-400">cached</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-zinc-400">
                <ClockIcon />
                <span>{formatDate(s.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
