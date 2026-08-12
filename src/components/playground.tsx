"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { TOOL_GUEST_DAILY_LIMIT } from "@/lib/tool-limits";

const CLIENT_ID_KEY = "screenshotapi_tools_client";

function generateClientId(): string {
  return `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = generateClientId();
    window.localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function Playground() {
  const { isSignedIn } = useAuth();
  const [clientId] = useState(getOrCreateClientId);
  const [url, setUrl] = useState("https://example.com");
  const [format, setFormat] = useState<"png" | "jpeg" | "webp" | "pdf">("png");
  const [width, setWidth] = useState(1280);
  const [fullPage, setFullPage] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [blockAds, setBlockAds] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ objectUrl: string; kind: "image" | "pdf" } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const isGuest = isSignedIn === false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const started = performance.now();
    try {
      const response = await fetch("/api/tools/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          format,
          viewport_width: width,
          full_page: fullPage,
          dark_mode: darkMode,
          block_ads: blockAds,
          block_cookie_banners: true,
          client_id: clientId,
        }),
      });

      const remainingHeader = response.headers.get("X-RateLimit-Remaining");
      if (remainingHeader !== null) setRemaining(Number(remainingHeader));

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
      if (result) URL.revokeObjectURL(result.objectUrl);
      setResult({ objectUrl: URL.createObjectURL(blob), kind: format === "pdf" ? "pdf" : "image" });
      setElapsed(Math.round(performance.now() - started));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const ext = format === "pdf" ? "pdf" : format === "jpeg" ? "jpg" : format;
    const a = document.createElement("a");
    a.href = result.objectUrl;
    a.download = `screenshot.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500";

  return (
    <section className="relative overflow-hidden border-b border-[var(--border)] py-20 lg:py-24">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(40rem_25rem_at_15%_50%,rgba(99,102,241,0.08),transparent),radial-gradient(40rem_25rem_at_85%_50%,rgba(168,85,247,0.08),transparent)]"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Live demo
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Try it right now — no signup required
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Point it at any website and watch the result render in seconds.
          </p>
        </div>

        <div className="mt-12 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-xl shadow-zinc-900/5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="playground-url" className="sr-only">
                  Website URL
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 focus-within:ring-2 focus-within:ring-indigo-500">
                  <svg className="h-4 w-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm1-17v5m0 0 4-4m-4 4-4-4" />
                  </svg>
                  <input
                    id="playground-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-transparent py-3 text-sm focus:outline-none"
                    required
                    autoComplete="url"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Rendering…
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                    Take Screenshot
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label htmlFor="playground-format" className="mb-1 block text-sm text-zinc-500">
                  Format
                </label>
                <select
                  id="playground-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as typeof format)}
                  className={inputClass}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>

              <div>
                <label htmlFor="playground-width" className="mb-1 block text-sm text-zinc-500">
                  Viewport width
                </label>
                <input
                  id="playground-width"
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  min={320}
                  max={3840}
                  className={inputClass}
                />
              </div>

              <label className="flex cursor-pointer items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                  className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                />
                <span className="text-sm text-zinc-500">Dark mode</span>
              </label>

              <label className="flex cursor-pointer items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={blockAds}
                  onChange={(e) => setBlockAds(e.target.checked)}
                  className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                />
                <span className="text-sm text-zinc-500">Block ads</span>
              </label>
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={fullPage}
                onChange={(e) => setFullPage(e.target.checked)}
                className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              />
              <span className="text-sm text-zinc-500">Full-page capture (scroll the entire page)</span>
            </label>
          </form>

          {isGuest && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <p>
                Guests are limited to <strong>{TOOL_GUEST_DAILY_LIMIT} captures per day</strong> (3 per minute).{" "}
                <Link href="/sign-up" className="font-semibold underline underline-offset-2">
                  Sign up free
                </Link>{" "}
                for 100 screenshots/month.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:border dark:border-red-900 dark:bg-red-950/60 dark:text-red-300" role="alert">
              {error}
            </div>
          )}

          <div className="mt-6">
            {result ? (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-zinc-50 px-4 py-2.5 dark:bg-zinc-900/70">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-zinc-500">Preview</span>
                    {elapsed !== null && (
                      <span className="rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                        {elapsed}ms
                      </span>
                    )}
                    {isGuest && remaining !== null && (
                      <span className="hidden rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20 sm:inline dark:bg-indigo-950/50 dark:text-indigo-400">
                        {remaining} of {TOOL_GUEST_DAILY_LIMIT} free captures left today
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download
                  </button>
                </div>
                {result.kind === "pdf" ? (
                  <iframe src={result.objectUrl} title="PDF preview" className="h-[480px] w-full bg-white" />
                ) : (
                  <img
                    src={result.objectUrl}
                    alt="Screenshot preview"
                    className="max-h-[520px] w-full bg-zinc-50 object-contain dark:bg-zinc-900"
                  />
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-14 text-center">
                <svg className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Your screenshot will appear here. All 4 formats supported in the demo — PNG, JPEG, WebP, and PDF.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
