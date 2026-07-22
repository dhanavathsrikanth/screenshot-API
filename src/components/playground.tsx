"use client";

import { useState } from "react";

export function Playground() {
  const [url, setUrl] = useState("https://example.com");
  const [format, setFormat] = useState<"png" | "jpeg" | "webp" | "pdf" | "html">("png");
  const [fullPage, setFullPage] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [blockAds, setBlockAds] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        url,
        format,
        full_page: String(fullPage),
        dark_mode: String(darkMode),
        block_ads: String(blockAds),
      });
      const response = await fetch(`/api/take?${params}`);
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
      const blob = await response.blob();
      setResult(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border-b border-[var(--border)] py-20 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold sm:text-3xl">Try it now — no signup required</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Enter any URL and see the result instantly. All 9 formats supported.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div className="flex gap-3">
            <label htmlFor="url" className="sr-only">
              Website URL
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
              required
              autoComplete="url"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {loading ? "Capturing..." : "Take Screenshot"}
            </button>
          </div>

          {/* Options */}
          <fieldset className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <legend className="sr-only">Render options</legend>
            
            <div>
              <label htmlFor="format" className="block text-zinc-500 mb-1 text-sm">
                Format
              </label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
                <option value="pdf">PDF</option>
                <option value="html">HTML</option>
              </select>
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fullPage}
                onChange={(e) => setFullPage(e.target.checked)}
                className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              />
              <span className="text-sm text-zinc-500">Full page</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              />
              <span className="text-sm text-zinc-500">Dark mode</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={blockAds}
                onChange={(e) => setBlockAds(e.target.checked)}
                className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              />
              <span className="text-sm text-zinc-500">Block ads</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="rounded border-[var(--border)] text-indigo-600"
              />
              <span className="text-sm text-zinc-500">Auto-block</span>
            </label>
          </fieldset>
        </form>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4" role="alert">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && format !== "html" && (
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-xs text-zinc-500">Preview ({format.toUpperCase()})</span>
              <a
                href={result}
                download={`screenshot.${format === "jpeg" ? "jpg" : format}`}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Download
              </a>
            </div>
            <img src={result} alt="Screenshot preview" className="w-full" />
          </div>
        )}
        {result && format === "html" && (
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-2 border-b border-[var(--border)]">
              <span className="text-xs text-zinc-500">Rendered HTML (copy to use)</span>
            </div>
            <pre className="p-4 max-h-96 overflow-auto text-xs text-green-400 bg-zinc-950">
              {result}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}