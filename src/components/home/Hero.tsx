"use client";

import { useState } from "react";
import Link from "next/link";

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

const quickUrls = ["https://example.com", "https://vercel.com", "https://stripe.com", "https://tailwindcss.com"];

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function Hero() {
  const [clientId] = useState(getOrCreateClientId);
  const [url, setUrl] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureScreenshot = async (rawUrl: string) => {
    const targetUrl = normalizeUrl(rawUrl);
    if (!targetUrl) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tools/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl, client_id: clientId, format: "png", viewport_width: 1280 }),
      });
      if (!response.ok) {
        let message = "Failed to render screenshot";
        try {
          const err = await response.json();
          message = typeof err.error === "string" ? err.error : err.error?.message ?? message;
        } catch {
          message = `Server error (${response.status})`;
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      if (screenshot) URL.revokeObjectURL(screenshot);
      setScreenshot(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-[0.4] [background-image:radial-gradient(circle_at_1px_1px,rgba(100,116,139,0.18)_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_35%,transparent_100%)] dark:opacity-[0.12]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-indigo-500/40 hover:text-indigo-600 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-indigo-300"
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-indigo-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            New: GIF &amp; TIFF formats
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>

          <h1 className="mt-6 text-balance text-4xl font-bold tracking-[-0.03em] text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
            Screenshots of any website,
            <br className="hidden sm:block" />
            <span className="text-indigo-600 dark:text-indigo-400">one API call</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Render pixel-perfect screenshots of any URL with full-page capture, dark mode, and automatic
            blocking of ads, cookie banners, and chat widgets. No browser setup required.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              Get Started Free
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/docs"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:w-auto"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              View Documentation
            </Link>
          </div>

          <div className="mx-auto mt-9 max-w-xl">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-4 pr-1.5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900">
              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm1-17v5m0 0 4-4m-4 4-4-4" />
              </svg>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") captureScreenshot(url);
                }}
                placeholder="https://example.com"
                className="w-full bg-transparent py-2 font-mono text-sm text-slate-600 focus:outline-none dark:text-slate-300"
              />
              <button
                onClick={() => captureScreenshot(url)}
                disabled={loading || !url}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Rendering
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                    </svg>
                    Take Screenshot
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {(loading || screenshot || error) && (
          <div className="relative mx-auto mt-12 max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
                  <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <span className="w-full truncate font-mono text-xs text-slate-600 dark:text-slate-300">{url}</span>
                </div>
                {screenshot && !loading && (
                  <a
                    href={screenshot}
                    download="screenshot.png"
                    className="hidden shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-500/40 hover:text-indigo-600 sm:inline-flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-indigo-400"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download
                  </a>
                )}
              </div>

              <div className="relative flex min-h-[320px] items-center justify-center bg-slate-100 p-2 dark:bg-slate-900/50 sm:min-h-[380px]">
                {loading ? (
                  <div className="flex flex-col items-center gap-4 py-20 text-slate-500">
                    <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-500/25 border-t-indigo-500" />
                    <p className="text-sm">Rendering {url}…</p>
                  </div>
                ) : screenshot ? (
                  <>
                    <img
                      src={screenshot}
                      alt={`Screenshot of ${url}`}
                      className="max-h-[560px] w-full rounded-lg object-cover"
                    />
                    {error && (
                      <div className="absolute inset-x-4 top-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300" role="alert">
                        {error}
                      </div>
                    )}
                    {!error && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400">
                          <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5m0-9a4.5 4.5 0 0 0 9 0m0 0a4.5 4.5 0 0 0 4.5 4.5M7.5 4.5h.008v.008H7.5V4.5Zm9 0h.008v.008h-.008V4.5Z" />
                          </svg>
                          Ads, cookie banners & chat widgets blocked automatically
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full px-6 py-16 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <p className="mx-auto mt-4 max-w-md text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-medium text-slate-400">Try with:</span>
          {quickUrls.map((u) => (
            <button
              key={u}
              onClick={() => {
                setUrl(u);
                captureScreenshot(u);
              }}
              className="rounded-full border border-[var(--border)] bg-white px-3 py-1.5 font-mono text-xs text-slate-500 transition-colors hover:border-indigo-500/50 hover:text-indigo-600 dark:bg-slate-900/70 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              {u.replace("https://", "")}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
