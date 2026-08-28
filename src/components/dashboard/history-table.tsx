"use client";

import { useCallback, useState, useTransition } from "react";
import { HistoryThumb } from "@/components/dashboard/history-thumb";
import { RetryButton } from "@/components/dashboard/retry-button";
import { createHistoryShare } from "@/app/actions/shares";
import type { ScreenshotRow } from "@/lib/history-types";

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

function ShareIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
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

const formatFullDate = (dateStr: string) => new Date(dateStr).toLocaleString();

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
    <span className="inline-flex items-center rounded-md bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 ring-1 ring-inset ring-orange-500/20">
      {label}
    </span>
  );
}

function ShareModal({ screenshotId, onClose }: { screenshotId: string; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await createHistoryShare(screenshotId);
        setShareUrl(result.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create share link.");
      }
    });
  }, [screenshotId]);

  const copyLink = useCallback(() => {
    if (!shareUrl) return;
    const full = window.location.origin + shareUrl;
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold">Share screenshot</h3>
        <p className="mt-1 text-xs text-[var(--dim)]">
          Create an expiring link that works without an account (7 days by default).
        </p>

        {error && (
          <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {shareUrl ? (
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] dark:bg-[var(--card)] px-3 py-2">
              <span className="flex-1 truncate font-mono text-xs text-[var(--dim)] dark:text-[var(--dim)]">
                {typeof window !== "undefined" ? window.location.origin : ""}{shareUrl}
              </span>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-md bg-orange-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-orange-700 transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-[var(--dim)]">Link expires in 7 days.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            {isPending ? "Creating…" : "Generate share link"}
          </button>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] dark:hover:bg-[var(--card)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function HistoryTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
}: {
  rows: ScreenshotRow[];
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
}) {
  const [shareTarget, setShareTarget] = useState<string | null>(null);
  const hasSelection = selected && onToggle && onToggleAll;
  const allSelected = hasSelection && selected.size === rows.length && rows.length > 0;

  return (
    <>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)] dark:bg-[var(--card)]">
                {hasSelection && (
                  <th className="px-4 py-3 w-[40px]">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleAll}
                      className="h-4 w-4 rounded border-[var(--line)] text-orange-600 focus:ring-orange-500"
                      aria-label="Select all"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] w-[80px]">Preview</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)]">URL</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] w-[80px]">Format</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] w-[110px]">Viewport</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)]">Options</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] w-[90px]">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] w-[80px]">Source</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] w-[80px]">Credits</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] w-[90px]">Time</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] w-[130px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const meta = (s.metadata ?? {}) as ScreenshotMetadata;
                const vpWidth = meta.viewport_width ?? s.width;
                const vpHeight = meta.viewport_height ?? s.height;
                return (
                  <tr
                    key={s.id}
                    className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] dark:hover:bg-[var(--card)]/50 transition-colors ${
                      hasSelection && selected.has(s.id) ? "bg-orange-50 dark:bg-orange-950/30" : ""
                    }`}
                  >
                    {hasSelection && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => onToggle(s.id)}
                          className="h-4 w-4 rounded border-[var(--line)] text-orange-600 focus:ring-orange-500"
                          aria-label={`Select screenshot ${s.id}`}
                        />
                      </td>
                    )}
                    {/* Thumbnail */}
                    <td className="px-4 py-3">
                      <div className="w-16 h-12 rounded-md bg-[var(--muted)] dark:bg-[var(--muted)] flex items-center justify-center overflow-hidden border border-[var(--border)]">
                        <HistoryThumb src={s.storage_url} format={s.format} />
                      </div>
                    </td>

                    {/* URL */}
                    <td className="px-4 py-3">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[var(--ink)] dark:text-[var(--ink)] hover:text-orange-600 dark:hover:text-orange-400 hover:underline max-w-[280px] truncate block"
                          title={s.url}
                        >
                          {formatUrl(s.url)}
                        </a>
                      ) : (
                        <span className="text-sm text-[var(--dim)]">-</span>
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
                      <span className="font-mono text-xs text-[var(--dim)] dark:text-[var(--dim)]">
                        {vpWidth}x{vpHeight}
                      </span>
                      {meta.full_page && (
                        <span className="ml-1.5 text-[10px] text-[var(--dim)]">full</span>
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
                          <span className="inline-flex items-center rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--dim)] dark:bg-[var(--muted)] dark:text-[var(--dim)] ring-1 ring-inset ring-[var(--dim)]/20" title={meta.selector}>
                            selector
                          </span>
                        )}
                        {meta.wait_until && meta.wait_until !== "domcontentloaded" && (
                          <span className="inline-flex items-center rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--dim)] dark:bg-[var(--muted)] dark:text-[var(--dim)] ring-1 ring-inset ring-[var(--dim)]/20">
                            {meta.wait_until}
                          </span>
                        )}
                        {meta.response_time_ms != null && (
                          <span className="inline-flex items-center rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--dim)] dark:bg-[var(--muted)] dark:text-[var(--dim)] ring-1 ring-inset ring-[var(--dim)]/20">
                            {meta.response_time_ms}ms
                          </span>
                        )}
                      </div>
                    </td>

                    {/* File size */}
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-xs text-[var(--dim)] dark:text-[var(--dim)]">
                        {formatBytes(s.file_size_bytes)}
                      </span>
                    </td>

                    {/* Source */}
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
                        <span className="text-[11px] text-[var(--dim)]">-</span>
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
                      <span className="text-xs text-[var(--dim)]" title={formatFullDate(s.created_at)}>
                        {formatDate(s.created_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.storage_url && (
                          <a
                            href={s.storage_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px] font-medium text-[var(--dim)] dark:text-[var(--dim)] hover:bg-[var(--muted)] dark:hover:bg-[var(--muted)] transition-colors"
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
                            className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-orange-700 transition-colors"
                            title="Download"
                          >
                            <DownloadIcon />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setShareTarget(s.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px] font-medium text-[var(--dim)] dark:text-[var(--dim)] hover:bg-[var(--muted)] dark:hover:bg-[var(--muted)] transition-colors"
                          title="Create share link"
                        >
                          <ShareIcon />
                        </button>
                        <RetryButton screenshotId={s.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {shareTarget && (
        <ShareModal screenshotId={shareTarget} onClose={() => setShareTarget(null)} />
      )}
    </>
  );
}
