"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { TOOL_GUEST_DAILY_LIMIT } from "@/lib/tool-limits";

type ToolMode = "screenshot" | "fullpage" | "pdf";

type CaptureResult = {
  objectUrl: string;
  kind: "image" | "pdf";
};

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

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function ToolCapture({ mode }: { mode: ToolMode }) {
  const { isSignedIn } = useAuth();
  const [clientId] = useState(getOrCreateClientId);
  const [url, setUrl] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [format, setFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [pdfFormat, setPdfFormat] = useState<"a4" | "letter" | "legal">("a4");
  const [width, setWidth] = useState(1280);
  const [darkMode, setDarkMode] = useState(false);
  const [fullPage, setFullPage] = useState(mode === "fullpage");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const isGuest = isSignedIn === false;
  const buttonLabel =
    mode === "pdf"
      ? loading
        ? "Generating…"
        : "Generate PDF"
      : mode === "fullpage"
        ? loading
          ? "Capturing…"
          : "Capture Full Page"
        : loading
          ? "Capturing…"
          : "Take Screenshot";

  const loadingLabel = mode === "pdf" ? "Generating PDF…" : `Capturing ${submittedUrl || "page"}…`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const targetUrl = normalizeUrl(url);
    if (!targetUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSubmittedUrl(targetUrl);

    const payload: Record<string, unknown> = {
      url: targetUrl,
      client_id: clientId,
      viewport_width: width,
      dark_mode: darkMode,
    };

    if (mode === "pdf") {
      payload.format = "pdf";
      payload.pdf_format = pdfFormat;
    } else {
      payload.format = format;
      payload.full_page = mode === "fullpage" ? true : fullPage;
    }

    try {
      const response = await fetch("/api/tools/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const remainingHeader = response.headers.get("X-RateLimit-Remaining");
      if (remainingHeader !== null) setRemaining(Number(remainingHeader));

      if (!response.ok) {
        let message = "Failed to capture";
        try {
          const err = await response.json();
          message = typeof err.error === "string" ? err.error : err.error?.message ?? message;
        } catch {
          message = `Server error (${response.status})`;
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setResult({ objectUrl, kind: mode === "pdf" ? "pdf" : "image" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const ext = mode === "pdf" ? "pdf" : format === "jpeg" ? "jpg" : format;
    const a = document.createElement("a");
    a.href = result.objectUrl;
    a.download = `screenshot.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div>
      {isGuest && (
        <div className="mb-6 flex items-start gap-2.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <p>
            This is a free tool — no account required. Guests are limited to{" "}
            <strong>{TOOL_GUEST_DAILY_LIMIT} captures per day</strong> (3 per minute).{" "}
            <Link href="/sign-up" className="font-semibold underline underline-offset-2">
              Sign up for free
            </Link>{" "}
            to raise your limit.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label htmlFor="tool-url" className="sr-only">
                Website URL
              </label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 focus-within:ring-2 focus-within:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900">
                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm1-17v5m0 0 4-4m-4 4-4-4" />
                </svg>
                <input
                  id="tool-url"
                  type="text"
                  inputMode="url"
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
              disabled={loading || !url}
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
              )}
              <span className="sr-only">Submit</span>
              <span>{buttonLabel}</span>
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="tool-format" className="mb-1 block text-sm text-slate-500 dark:text-slate-400">
                {mode === "pdf" ? "Page size" : "Format"}
              </label>
              {mode === "pdf" ? (
                <select
                  id="tool-format"
                  value={pdfFormat}
                  onChange={(e) => setPdfFormat(e.target.value as typeof pdfFormat)}
                  className={inputClass}
                >
                  <option value="a4">A4</option>
                  <option value="letter">Letter</option>
                  <option value="legal">Legal</option>
                </select>
              ) : (
                <select
                  id="tool-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as typeof format)}
                  className={inputClass}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                </select>
              )}
            </div>

            <div>
              <label htmlFor="tool-width" className="mb-1 block text-sm text-slate-500 dark:text-slate-400">
                Viewport width
              </label>
              <input
                id="tool-width"
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                min={320}
                max={3840}
                className={inputClass}
              />
            </div>

            {mode === "screenshot" && (
              <label className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={fullPage}
                  onChange={(e) => setFullPage(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">Full page</span>
              </label>
            )}

            <label className="flex items-end gap-2 pb-2">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">Dark mode</span>
            </label>
          </div>
        </form>
      </div>

      {(loading || result || error) && (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
              <span className="w-full truncate font-mono text-xs text-slate-600 dark:text-slate-300">
                {submittedUrl || "Loading…"}
              </span>
            </div>
            {result && !loading && (
              <button
                onClick={handleDownload}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-500/40 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-indigo-400"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download {mode === "pdf" ? "PDF" : "image"}
              </button>
            )}
          </div>

          <div className="relative flex min-h-[320px] items-center justify-center bg-slate-100 p-2 dark:bg-slate-900/50 sm:min-h-[380px]">
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-20 text-slate-500">
                <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-500/25 border-t-indigo-500" />
                <p className="text-sm">{loadingLabel}</p>
              </div>
            ) : result ? (
              result.kind === "pdf" ? (
                <iframe src={result.objectUrl} title="PDF preview" className="h-[600px] w-full rounded-lg bg-white" />
              ) : (
                <>
                  <img
                    src={result.objectUrl}
                    alt="Screenshot preview"
                    className="max-h-[560px] w-full rounded-lg object-cover"
                  />
                  {isGuest && remaining !== null && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400">
                        {remaining} of {TOOL_GUEST_DAILY_LIMIT} free captures left today
                      </span>
                    </div>
                  )}
                </>
              )
            ) : error ? (
              <div className="w-full px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <p className="mx-auto mt-4 max-w-md text-sm text-red-700 dark:text-red-300" role="alert">
                  {error}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
