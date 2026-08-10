"use client";

import { useState, useCallback } from "react";

const CREDIT_COSTS: Record<string, number> = { png: 1, jpg: 1, jpeg: 1, webp: 1, pdf: 5 };

function getCreditCost(format: string): number {
  return CREDIT_COSTS[format] ?? 1;
}

export function DashboardPlayground() {
  const [url, setUrl] = useState("https://example.com");
  const [format, setFormat] = useState<"png" | "jpeg" | "webp" | "pdf">("png");
  const [fullPage, setFullPage] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [width, setWidth] = useState(1280);
  const [result, setResult] = useState<string | null>(null);
  const [storageUrl, setStorageUrl] = useState<string | null>(null);
  const [resultType, setResultType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setStorageUrl(null);
    setResultType(null);
    setCreditsUsed(null);

    try {
      const response = await fetch("/api/take", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url,
          format,
          viewport_width: width,
          full_page: fullPage,
          dark_mode: darkMode,
        }),
      });

      if (!response.ok) {
        let message = "Failed to render screenshot";
        try {
          const err = await response.json();
          message = err.error ?? message;
        } catch {
          message = `Server error (${response.status})`;
        }
        throw new Error(message);
      }

      const data = await response.json();
      const headerCost = response.headers.get("X-Credits-Used");
      setCreditsUsed(headerCost != null ? Number(headerCost) : getCreditCost(format));

      if (data.url) {
        setStorageUrl(data.url);
        setResult(data.url);
        setResultType(format === "pdf" ? "pdf" : "image");
      } else {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setResult(objectUrl);
        setResultType(format === "pdf" ? "pdf" : "image");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [url, format, fullPage, darkMode, width]);

  const handleDownload = useCallback(() => {
    const href = storageUrl ?? result;
    if (!href) return;
    const a = document.createElement("a");
    a.href = href;
    a.download = `screenshot.${format === "jpeg" ? "jpg" : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result, storageUrl, format]);

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? "Capturing..." : "Take Screenshot"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Width</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              min={320}
              max={3840}
              className="w-20 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={fullPage}
              onChange={(e) => setFullPage(e.target.checked)}
              className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-zinc-500">Full page</span>
          </label>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-zinc-500">Dark mode</span>
          </label>
          <span className="text-xs text-zinc-400 ml-auto">
            Cost: <span className="font-semibold text-amber-600 dark:text-amber-400">{getCreditCost(format)} credit{getCreditCost(format) !== 1 ? "s" : ""}</span>
          </span>
        </div>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 mt-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">Preview</span>
              {creditsUsed != null && (
                <span className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20">
                  {creditsUsed} credit{creditsUsed !== 1 ? "s" : ""} used
                </span>
              )}
              {storageUrl && (
                <a href={storageUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">
                  View saved
                </a>
              )}
            </div>
            <button
              onClick={handleDownload}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Download
            </button>
          </div>
          {resultType === "pdf" ? (
            <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900">
              <svg className="mx-auto h-12 w-12 text-zinc-400 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="text-sm text-zinc-500">PDF ready for download</p>
            </div>
          ) : (
            <img
              src={result}
              alt="Screenshot preview"
              className="w-full max-h-[500px] object-contain bg-zinc-50 dark:bg-zinc-900"
            />
          )}
        </div>
      )}

      {!result && !error && !loading && (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-sm text-zinc-500">Enter a URL and click Take Screenshot to see the result here.</p>
        </div>
      )}
    </div>
  );
}
