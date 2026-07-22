import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getScreenshotHistory } from "@/app/actions/usage";
import { getSignedDownloadUrl } from "@/screenshot-engine/uploader";

type ScreenshotMetadata = {
  full_page?: boolean;
  dark_mode?: boolean;
  viewport_width?: number;
  viewport_height?: number;
  block_ads?: boolean;
  block_trackers?: boolean;
  block_cookie_banners?: boolean;
  selector?: string;
  wait_until?: string;
  quality?: number;
  method?: string;
  response_time_ms?: number;
  cached?: boolean;
  credits_used?: number;
  mode?: string;
};

const CREDIT_COSTS: Record<string, number> = { png: 1, jpg: 1, jpeg: 1, webp: 1, pdf: 5 };

function getCreditCost(format: string, meta: ScreenshotMetadata): number {
  if (meta.credits_used != null) return meta.credits_used;
  return CREDIT_COSTS[format] ?? 1;
}

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
  metadata?: ScreenshotMetadata;
};

function DownloadIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

const formatBytes = (bytes: number | null) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const formatFullDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleString();
};

const formatUrl = (url: string | null) => {
  if (!url) return "(no URL)";
  try {
    const parsed = new URL(url);
    return parsed.hostname + parsed.pathname.slice(0, 40) + (parsed.pathname.length > 40 ? "..." : "");
  } catch {
    return url.slice(0, 50);
  }
};

function OptionBadge({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
      {label}
    </span>
  );
}

export default async function HistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let screenshots: Screenshot[] = [];
  try {
    screenshots = await getScreenshotHistory(userId, 100);
  } catch {
    screenshots = [];
  }

  const signedUrlMap = new Map<string, string>();
  await Promise.all(
    screenshots
      .filter((s) => s.storage_url)
      .map(async (s) => {
        try {
          const url = await getSignedDownloadUrl(s.storage_url!);
          signedUrlMap.set(s.storage_url!, url);
        } catch {}
      })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Screenshot History</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Every screenshot captured from the playground and API calls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">{screenshots.length} captures</span>
        </div>
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
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-[80px]">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-[80px]">
                    Format
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-[110px]">
                    Viewport
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    Options
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-[90px]">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-[80px]">
                    Source
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-[80px]">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-[90px]">
                    Time
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {screenshots.map((s) => {
                  const meta = s.metadata ?? {};
                  const vpWidth = meta.viewport_width ?? s.width;
                  const vpHeight = meta.viewport_height ?? s.height;
                  const imageUrl = s.storage_url ? (signedUrlMap.get(s.storage_url) ?? null) : null;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                    >
                      {/* Thumbnail */}
                      <td className="px-4 py-3">
                        <div className="w-16 h-12 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-[var(--border)]">
                          {imageUrl && s.format !== "pdf" ? (
                            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </a>
                          ) : (
                            <span className="text-[9px] font-bold text-zinc-400 uppercase">
                              {s.format}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* URL */}
                      <td className="px-4 py-3">
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline max-w-[280px] truncate block"
                            title={s.url}
                          >
                            {formatUrl(s.url)}
                          </a>
                        ) : (
                          <span className="text-sm text-zinc-400">-</span>
                        )}
                      </td>

                      {/* Format */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ring-1 ring-inset ${
                          s.format === "pdf"
                            ? "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-400"
                            : s.format === "webp"
                              ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950/50 dark:text-green-400"
                              : s.format === "jpeg"
                                ? "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400"
                                : "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-400"
                        }`}>
                          {s.format}
                        </span>
                      </td>

                      {/* Viewport */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {vpWidth}x{vpHeight}
                        </span>
                        {meta.full_page && (
                          <span className="ml-1.5 text-[10px] text-zinc-400">full</span>
                        )}
                      </td>

                      {/* Options badges */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <OptionBadge label="dark" active={meta.dark_mode ?? false} />
                          <OptionBadge label="ads" active={meta.block_ads ?? false} />
                          <OptionBadge label="trackers" active={meta.block_trackers ?? false} />
                          <OptionBadge label="cookies" active={meta.block_cookie_banners ?? false} />
                          {meta.selector && (
                            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 ring-1 ring-inset ring-zinc-500/20" title={meta.selector}>
                              selector
                            </span>
                          )}
                          {meta.wait_until && meta.wait_until !== "domcontentloaded" && (
                            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 ring-1 ring-inset ring-zinc-500/20">
                              {meta.wait_until}
                            </span>
                          )}
                          {meta.response_time_ms != null && (
                            <span className="inline-flex items-center rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 ring-1 ring-inset ring-zinc-500/20">
                              {meta.response_time_ms}ms
                            </span>
                          )}
                        </div>
                      </td>

                      {/* File size */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {formatBytes(s.file_size_bytes)}
                        </span>
                      </td>

                      {/* Source (API / Playground) */}
                      <td className="px-4 py-3">
                        {meta.method ? (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${
                            meta.method === "POST"
                              ? "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950/50 dark:text-violet-400"
                              : "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-950/50 dark:text-cyan-400"
                          }`}>
                            {meta.method}
                          </span>
                        ) : s.cached ? (
                          <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-950/50 dark:text-green-400">
                            cached
                          </span>
                        ) : (
                          <span className="text-[11px] text-zinc-400">-</span>
                        )}
                      </td>

                      {/* Credits */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
                          s.cached
                            ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950/50 dark:text-green-400"
                            : getCreditCost(s.format, meta) >= 5
                              ? "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400"
                              : "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-400"
                        }`}>
                          {s.cached ? "0" : getCreditCost(s.format, meta)}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs text-zinc-500" title={formatFullDate(s.created_at)}>
                          {formatDate(s.created_at)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {imageUrl && (
                            <a
                              href={imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                              title="Open full image"
                            >
                              <ExternalLinkIcon />
                              Open
                            </a>
                          )}
                          {imageUrl && (
                            <a
                              href={imageUrl}
                              download={`screenshot.${s.format === "jpeg" ? "jpg" : s.format}`}
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 transition-colors"
                              title="Download"
                            >
                              <DownloadIcon />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
