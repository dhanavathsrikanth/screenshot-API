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

export function Hero() {
  const [clientId] = useState(getOrCreateClientId);
  const [url, setUrl] = useState("https://example.com");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureScreenshot = async (targetUrl: string) => {
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
          message = err.error ?? message;
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
        className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_70%_-10%,rgba(99,102,241,0.18),transparent),radial-gradient(50rem_35rem_at_10%_110%,rgba(168,85,247,0.14),transparent)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.35] dark:opacity-[0.15] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_35%,transparent_100%)]"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)]/70 px-4 py-1.5 text-sm font-medium text-zinc-600 shadow-sm backdrop-blur transition-colors hover:border-indigo-500/40 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400"
          >
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-indigo-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            New: GIF & TIFF formats are here
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </a>

          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Screenshots of any website,
            <br className="hidden sm:block" />
            <span className="gradient-text">one API call</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Render pixel-perfect screenshots of any URL with full-page capture, dark mode, and automatic
            blocking of ads, cookie banners, and chat widgets. No browser setup required.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:bg-indigo-700 hover:shadow-indigo-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              Get Started Free
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/docs"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)]/70 px-7 py-3.5 text-base font-semibold text-zinc-700 backdrop-blur transition-colors hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-zinc-200 dark:hover:bg-zinc-800/50 sm:w-auto"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              View Documentation
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              100 screenshots / month free
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              9 output formats
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </span>
              No credit card required
            </span>
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-4xl">
          <div
            className="absolute -inset-x-8 -top-8 bottom-0 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-transparent blur-2xl"
            aria-hidden="true"
          />

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl shadow-zinc-900/10 dark:shadow-black/40">
            <div className="flex items-center gap-3 border-b border-[var(--border)] bg-zinc-50/80 px-4 py-3 dark:bg-zinc-900/70">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5">
                <svg className="h-3.5 w-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
                  className="w-full bg-transparent font-mono text-xs text-zinc-600 focus:outline-none dark:text-zinc-300"
                />
                <button
                  onClick={() => captureScreenshot(url)}
                  disabled={loading || !url}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Rendering
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                      </svg>
                      Capture
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="relative flex min-h-[320px] items-center justify-center bg-zinc-100/70 p-2 dark:bg-zinc-900/50 sm:min-h-[380px]">
              {screenshot ? (
                <img src={screenshot} alt="Live screenshot preview" className="max-h-[520px] w-full rounded-lg object-cover" />
              ) : loading ? (
                <div className="flex flex-col items-center gap-3 py-20 text-zinc-500">
                  <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-500/25 border-t-indigo-500" />
                  <p className="text-sm">Rendering {url}…</p>
                </div>
              ) : (
                <div className="py-16 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 text-indigo-500 dark:text-indigo-400">
                    <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                  <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                    Enter a URL above and hit Capture to see it live
                  </p>
                </div>
              )}

              {error && (
                <div className="absolute inset-x-4 top-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300" role="alert">
                  {error}
                </div>
              )}

              {!loading && !error && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--background)]/90 px-3 py-1.5 text-xs text-zinc-500 shadow-sm backdrop-blur">
                    <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5m0-9a4.5 4.5 0 0 0 9 0m0 0a4.5 4.5 0 0 0 4.5 4.5M7.5 4.5h.008v.008H7.5V4.5Zm9 0h.008v.008h-.008V4.5Z" />
                    </svg>
                    Ads, cookie banners & chat widgets blocked automatically
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="absolute -left-4 top-1/4 hidden -translate-x-full flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-xl lg:flex">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">API Latency</p>
            <p className="flex items-baseline gap-1 text-2xl font-bold">
              412<span className="text-sm font-medium text-zinc-400">ms</span>
            </p>
            <span className="inline-flex w-fit items-center rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
              p95 worldwide
            </span>
          </div>

          <div className="absolute -right-4 top-1/2 hidden -translate-y-1/2 translate-x-full flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-xl lg:flex">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Uptime</p>
            <p className="flex items-baseline gap-1 text-2xl font-bold">
              99.9<span className="text-sm font-medium text-zinc-400">%</span>
            </p>
            <span className="inline-flex w-fit items-center rounded-md bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
              SLA backed
            </span>
          </div>

          <div className="absolute -bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 shadow-xl lg:flex">
            <svg className="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Full-page • Dark mode • Element selector • PDF
            </span>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs font-medium text-zinc-400">Try with:</span>
          {quickUrls.map((u) => (
            <button
              key={u}
              onClick={() => {
                setUrl(u);
                captureScreenshot(u);
              }}
              className="rounded-full border border-[var(--border)] px-3 py-1.5 font-mono text-xs text-zinc-500 transition-colors hover:border-indigo-500/50 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              {u.replace("https://", "")}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
