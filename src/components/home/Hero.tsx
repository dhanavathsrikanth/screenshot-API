"use client";

import { useState } from "react";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { CodeBlock } from "@/components/code-block";
import { captureClientFunnel, FUNNEL_EVENTS } from "@/lib/funnel";

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

type DemoFormat = "png" | "jpeg" | "webp";

export function Hero() {
  const [clientId] = useState(getOrCreateClientId);
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<DemoFormat>("png");
  const [fullPage, setFullPage] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [capturedUrl, setCapturedUrl] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ext = format === "jpeg" ? "jpg" : format;

  function buildCurl(targetUrl: string): string {
    const params = new URLSearchParams({ url: targetUrl, format });
    if (fullPage) params.set("full_page", "true");
    if (darkMode) params.set("dark_mode", "true");
    return [
      `curl "${siteConfig.apiUrl}/api/take?${params.toString()}" \\`,
      `  -H "Authorization: Bearer YOUR_API_KEY" \\`,
      `  -o screenshot.${ext}`,
    ].join("\n");
  }

  const captureScreenshot = async (rawUrl: string) => {
    const targetUrl = normalizeUrl(rawUrl);
    if (!targetUrl) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tools/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          client_id: clientId,
          format,
          full_page: fullPage,
          dark_mode: darkMode,
          viewport_width: 1280,
        }),
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
      setCapturedUrl(targetUrl);
      let host = "";
      try {
        host = new URL(targetUrl).host;
      } catch {
        host = "";
      }
      captureClientFunnel(FUNNEL_EVENTS.demoCaptured, {
        format,
        full_page: fullPage,
        dark_mode: darkMode,
        host,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      captureClientFunnel(FUNNEL_EVENTS.demoFailed, {
        message: e instanceof Error ? e.message.slice(0, 140) : "unknown",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleClass = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
      active
        ? "bg-[var(--ink)] text-[var(--background)]"
        : "text-[var(--dim)] hover:text-[var(--ink)] hover:bg-[var(--muted)]"
    }`;

  return (
    <section className="pt-16 pb-8">
      <div className="mx-auto max-w-3xl px-6">
<a
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--dim)] transition-colors hover:text-[var(--ink)] dark:bg-[var(--card)]"
          >
          <span className="relative flex h-1.5 w-1.5 items-center justify-center">
            <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
          New: GIF &amp; TIFF formats
        </a>

        <h1 className="text-balance mt-6 mb-4 text-[26px] leading-tight tracking-[-0.02em] sm:text-[34px] font-medium">
          Screenshots of any website,
          <br className="hidden sm:block" />
          <span className="text-[var(--accent)]">one API call</span>
        </h1>

        <p className="text-pretty leading-[1.6] text-[var(--dim)] max-w-2xl">
          Render pixel-perfect screenshots of any URL with full-page capture, dark mode, and automatic
          blocking of ads, cookie banners, and chat widgets. No browser setup required.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/sign-up"
            onClick={() =>
              captureClientFunnel(FUNNEL_EVENTS.ctaClicked, { location: "hero_primary", target: "/sign-up" })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-colors active:scale-[0.96]"
          >
            Get Started Free
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--muted)]"
          >
            <svg className="h-3.5 w-3.5 text-[var(--dim)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Documentation
          </Link>
        </div>

        <div className="mt-10 max-w-xl">
          <div className="term-window overflow-hidden rounded-lg border border-[var(--line)] bg-white dark:bg-[var(--card)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--line)] bg-[#f5f5f4] px-3.5 py-2.5 dark:bg-[var(--muted)]">
              <span className="inline-block size-2.25 rounded-full bg-[var(--line)]" />
              <span className="inline-block size-2.25 rounded-full bg-[var(--line)]" />
              <span className="inline-block size-2.25 rounded-full bg-[var(--line)]" />
              <span className="ml-2 font-mono text-[11.5px] text-[var(--dim)]">screenshot demo</span>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-white py-2 pl-3 pr-2 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]/20 dark:bg-[var(--card)]">
                <svg className="h-4 w-4 shrink-0 text-[var(--dim)]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
                  className="w-full bg-transparent py-1 font-mono text-sm text-[var(--ink)] focus:outline-none placeholder:text-[var(--line)]"
                />
                <button
                  onClick={() => captureScreenshot(url)}
                  disabled={loading || !url}
                  className="flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-[var(--background)] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--background)]/30 border-t-[var(--background)]" />
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

              <div className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2">
                <div className="flex items-center rounded-md border border-[var(--line)] bg-white p-0.5 dark:bg-[var(--card)]">
                  {(["png", "jpeg", "webp"] as DemoFormat[]).map((f) => (
                    <button key={f} onClick={() => setFormat(f)} className={toggleClass(format === f)} aria-pressed={format === f}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setFullPage(!fullPage)}
                  className={toggleClass(fullPage)}
                  aria-pressed={fullPage}
                >
                  Full page
                </button>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={toggleClass(darkMode)}
                  aria-pressed={darkMode}
                >
                  Dark mode
                </button>
                <span className="ml-1 text-[11px] text-[var(--dim)]">no signup needed</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--dim)]">Try with:</span>
            {quickUrls.map((u) => (
              <button
                key={u}
                onClick={() => {
                  setUrl(u);
                  captureScreenshot(u);
                }}
                className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 font-mono text-[11px] text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] dark:bg-[var(--card)]"
              >
                {u.replace("https://", "")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(loading || screenshot || error) && (
        <div className="mx-auto mt-10 max-w-3xl px-6">
          <div className="term-window overflow-hidden rounded-lg border border-[var(--line)] bg-white dark:bg-[var(--card)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--line)] bg-[#f5f5f4] px-3.5 py-2.5 dark:bg-[var(--muted)]">
              <span className="inline-block size-2.25 rounded-full bg-[var(--line)]" />
              <span className="inline-block size-2.25 rounded-full bg-[var(--line)]" />
              <span className="inline-block size-2.25 rounded-full bg-[var(--line)]" />
              <span className="ml-2 font-mono text-[11.5px] text-[var(--dim)] truncate max-w-xs">{capturedUrl || url}</span>
              {screenshot && !loading && (
                <a
                  href={screenshot}
                  download={`screenshot.${ext}`}
                  className="ml-auto text-[11px] text-[var(--dim)] hover:text-[var(--ink)]"
                >
                  download
                </a>
              )}
            </div>
            <div className="relative min-h-[280px] bg-[var(--muted)] p-2 sm:min-h-[340px]">
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-20 text-[var(--dim)]">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />
                  <p className="text-xs font-mono">Rendering {url}...</p>
                </div>
              ) : screenshot && !error ? (
                <>
                  <img
                    src={screenshot}
                    alt={`Screenshot of ${capturedUrl || url}`}
                    className="max-h-[500px] w-full rounded object-cover"
                  />
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11px] text-[var(--dim)] shadow-sm dark:bg-[var(--card)]">
                      <svg className="h-3 w-3 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      Ads &amp; banners blocked automatically
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-16 text-center">
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
                  <p className="mt-2 text-xs text-[var(--dim)]">
                    Guest captures are limited per day — sign up free for more.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {screenshot && !loading && !error && capturedUrl && (
        <div className="mx-auto mt-8 max-w-3xl px-6">
          <div className="rounded-lg border border-[var(--line)] bg-white p-6 dark:bg-[var(--card)]">
            <p className="font-mono text-[11px] tracking-[0.08em] text-[var(--dim)] uppercase">
              You just used the same engine behind our API
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em]">
              Automate this with one line of code
            </h2>
            <p className="mt-2 text-sm text-[var(--dim)]">
              Get a free API key and turn what you just did into a single authenticated GET request.
            </p>
            <div className="mt-4">
              <CodeBlock code={buildCurl(capturedUrl)} label="Equivalent API call" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Link
                href="/sign-up"
                onClick={() =>
                  captureClientFunnel(FUNNEL_EVENTS.ctaClicked, {
                    location: "demo_code_panel",
                    target: "/sign-up",
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--background)] transition-colors"
              >
                Get your free API key
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--muted)]"
              >
                Explore all parameters
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
