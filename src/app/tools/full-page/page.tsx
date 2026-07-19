"use client";

import { useState } from "react";

export default function FullPageTool() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(
        `/api/take?url=${encodeURIComponent(url)}&format=png&full_page=true`
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? "Failed to render");
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
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-4">Full Page Screenshot</h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-8">
        Capture an entire webpage from top to bottom. Lazy-loaded images are triggered automatically.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Capturing..." : "Capture Full Page"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 mb-6">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-2 border-b border-[var(--border)]">
            <span className="text-xs text-zinc-500">Full Page Preview</span>
          </div>
          <img src={result} alt="Full page screenshot" className="w-full" />
        </div>
      )}
    </div>
  );
}
