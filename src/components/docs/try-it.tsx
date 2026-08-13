"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { siteConfig } from "@/lib/site";
import { CodeBlock } from "@/components/docs/code-block";

type Result = {
  kind: "image" | "pdf";
  objectUrl: string;
  headers: Record<string, string>;
};

function extractError(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "error" in err) {
    const e = (err as { error?: { message?: string } | string }).error;
    if (typeof e === "string") return e;
    if (e?.message) return e.message;
  }
  return fallback;
}

export function TryIt() {
  const { isSignedIn } = useAuth();
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<"png" | "jpeg" | "webp" | "pdf">("png");
  const [fullPage, setFullPage] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  function normalizeUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function buildQuery(targetUrl: string): URLSearchParams {
    const params = new URLSearchParams({ url: targetUrl, format });
    if (fullPage) params.set("full_page", "true");
    if (darkMode) params.set("dark_mode", "true");
    return params;
  }

  function curlCommand(targetUrl: string): string {
    const params = buildQuery(targetUrl);
    const auth = apiKey.trim() ? `  -H "Authorization: Bearer ${apiKey.trim()}" \\\n` : "";
    return `curl \\\n${auth}  "${siteConfig.url}/api/take?${params.toString()}" \\
  --output screenshot.${format === "jpeg" ? "jpg" : format}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetUrl = normalizeUrl(url);
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const headers: Record<string, string> = {};
      const key = apiKey.trim();
      if (key) headers.Authorization = `Bearer ${key}`;

      const response = await fetch(`/api/take?${buildQuery(targetUrl).toString()}`, {
        headers,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        setError(extractError(err, `Server error (${response.status})`));
        return;
      }

      const contentType = response.headers.get("Content-Type") ?? "";
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      if (result) URL.revokeObjectURL(result.objectUrl);

      const headerMap: Record<string, string> = {};
      for (const name of [
        "x-request-id",
        "x-cache",
        "x-credits-used",
        "x-ratelimit-limit",
        "x-ratelimit-remaining",
        "x-ratelimit-reset",
      ]) {
        const value = response.headers.get(name);
        if (value) headerMap[name] = value;
      }

      setResult({ kind: contentType.includes("pdf") ? "pdf" : "image", objectUrl, headers: headerMap });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
      <div className="border-b border-[var(--border)] px-6 py-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Live API playground</h3>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Try the real endpoint. Signed-in users are authenticated automatically; otherwise paste an API key.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <div>
          <label htmlFor="tryit-url" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
            URL
          </label>
          <input
            id="tryit-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="tryit-format" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Format
            </label>
            <select
              id="tryit-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "png" | "jpeg" | "webp" | "pdf")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:bg-slate-950 dark:text-white"
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Options</span>
            <div className="flex h-[38px] items-center gap-4">
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                <input type="checkbox" checked={fullPage} onChange={(e) => setFullPage(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Full page
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} className="rounded border-slate-300 text-indigo-600" />
                Dark mode
              </label>
            </div>
          </div>
          <div className="col-span-2 sm:col-span-2">
            <label htmlFor="tryit-key" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              API key {isSignedIn ? "(optional)" : "(required)"}
            </label>
            <input
              id="tryit-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isSignedIn ? "sk_… (or rely on your session)" : "sk_…"}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-indigo-500 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !normalizeUrl(url) || (!isSignedIn && !apiKey.trim())}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Rendering…" : "Run request"}
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </form>

      {result && (
        <div className="border-t border-[var(--border)] px-6 py-5">
          <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Response</p>
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {result.kind === "pdf" ? (
              <iframe title="Rendered PDF" src={result.objectUrl} className="h-80 w-full bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.objectUrl} alt="Screenshot preview" className="max-h-96 w-full bg-white object-contain" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(result.headers).map(([name, value]) => (
              <span key={name} className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                {name}: {value}
              </span>
            ))}
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Equivalent cURL request</p>
            <CodeBlock code={curlCommand(url)} label="bash" />
          </div>
        </div>
      )}
    </div>
  );
}
