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

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
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
          Your latest rendered screenshots. Click any row to open the full image.
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
              className="group rounded-xl border border-[var(--border)] p-4 flex items-center gap-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-20 h-14 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-[var(--border)]">
                {s.storage_url ? (
                  <a href={s.storage_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={s.storage_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <span className="text-[10px] font-medium text-zinc-400 uppercase">
                    {s.format}
                  </span>
                )}
              </div>

              {/* Info */}
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

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-2">
                {s.storage_url && (
                  <a
                    href={s.storage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    title="Open full image"
                  >
                    <ExternalLinkIcon />
                    Open
                  </a>
                )}
                {s.storage_url && (
                  <a
                    href={s.storage_url}
                    download={`screenshot.${s.format === "jpeg" ? "jpg" : s.format}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                    title="Download"
                  >
                    <DownloadIcon />
                  </a>
                )}
                <span className="text-xs text-zinc-400 ml-1">
                  {formatDate(s.created_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
