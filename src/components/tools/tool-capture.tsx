"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { TOOL_GUEST_DAILY_LIMIT } from "@/lib/tool-limits";
import { captureClientFunnel, FUNNEL_EVENTS } from "@/lib/funnel";

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

const QUICK_URLS = ["https://unsplash.com", "https://stripe.com", "https://linear.app"];
const WIDTH_PRESETS = [390, 768, 1280, 1920];

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
      captureClientFunnel(FUNNEL_EVENTS.freeToolCaptured, {
        mode,
        format: mode === "pdf" ? "pdf" : format,
        signed_in: !isGuest,
      });
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

  return (
    <div className="space-y-5">
      {/* Guest banner — Google-style, dismissible feel, no behavior change */}
      {isGuest && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 px-4 py-3.5 shadow-sm dark:border-indigo-900 dark:from-indigo-950/40 dark:to-violet-950/20">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-indigo-900 dark:text-indigo-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          </span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold leading-none text-indigo-900 dark:text-indigo-100">Free tool — no account required</p>
            <p className="mt-1 text-[13px] leading-relaxed text-indigo-700/80 dark:text-indigo-300/80">
              Guests get <strong className="font-semibold text-indigo-900 dark:text-indigo-100">{TOOL_GUEST_DAILY_LIMIT} captures / day</strong> (3/min). Captures are watermark-free.{" "}
              <Link href="/sign-up" className="inline-flex items-center gap-1 font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-700 dark:text-indigo-400">
                Sign up for free <span aria-hidden>→</span>
              </Link>
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-indigo-700 shadow-sm dark:bg-indigo-900 dark:text-indigo-200">Guest</span>
        </div>
      )}

      {/* Main control card — Google clean, elevated, 12px radius system preserved */}
      <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSubmit} className="p-5 sm:p-6">
          {/* URL — large, accessible, 56px hit target, clear affordance */}
          <label htmlFor="tool-url" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            Website URL <span className="text-red-500">*</span>
            <span className="ml-auto hidden sm:inline text-[11px] font-medium normal-case tracking-normal text-slate-400">Press ↵ to capture</span>
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-1-9h2m-2 0a4 4 0 1 1 4 0 4 4 0 0 1-4 0Zm4 0v2a4 4 0 1 1-4 0" /></svg>
              </div>
              <input
                id="tool-url"
                type="text"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com  —  try unsplash.com"
                className="h-[52px] w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-10 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
                autoComplete="url"
              />
              {url && (
                <button type="button" onClick={() => setUrl("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700" aria-label="Clear">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 text-[15px] font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.25)] transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-600/20"
            >
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : (
                <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
              )}
              {buttonLabel}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Try:</span>
            {QUICK_URLS.map((q) => (
              <button key={q} type="button" onClick={() => setUrl(q)} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {q.replace("https://", "")}
              </button>
            ))}
            <span className="ml-auto hidden items-center gap-1 text-xs text-slate-400 sm:inline-flex">↵ Enter to capture • 10 free / day</span>
          </div>

          {/* Controls — easy scan, Google segmented + toggle switches, all existing fields preserved */}
          <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 sm:grid-cols-12">
            <div className="sm:col-span-4">
              <label htmlFor="tool-format" className="block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                {mode === "pdf" ? "Page size" : "Format"}
              </label>
              <div className="mt-2">
                {mode === "pdf" ? (
                  <select id="tool-format" value={pdfFormat} onChange={(e) => setPdfFormat(e.target.value as typeof pdfFormat)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 dark:border-slate-700 dark:bg-slate-900">
                    <option value="a4">A4 — standard</option>
                    <option value="letter">Letter — US</option>
                    <option value="legal">Legal — long</option>
                  </select>
                ) : (
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
                    {(["png", "jpeg", "webp"] as const).map((f) => (
                      <button key={f} type="button" onClick={() => setFormat(f)} className={`rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-wide transition ${format === f ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">{mode === "pdf" ? "PDF keeps vectors & text selectable" : format === "png" ? "Best quality" : format === "webp" ? "Modern, small" : "Small file"}</p>
            </div>

            <div className="sm:col-span-4">
              <label htmlFor="tool-width" className="block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                Viewport width
              </label>
              <input id="tool-width" type="number" value={width} onChange={(e) => setWidth(Number(e.target.value))} min={320} max={3840} className="mt-2 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-mono font-medium focus:border-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-600/10 dark:border-slate-700 dark:bg-slate-900" />
              <div className="mt-2 flex gap-1">
                {WIDTH_PRESETS.map((w) => (
                  <button key={w} type="button" onClick={() => setWidth(w)} className={`flex-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${width === w ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"}`}>{w}</button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Options</p>
              <div className="mt-2 space-y-2">
                {mode === "screenshot" && (
                  <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900">
                    <span className="flex items-center gap-2.5">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M6.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" /></svg></span>
                      <span className="text-[13px] font-medium text-slate-900 dark:text-white">Full page</span>
                    </span>
                    <input type="checkbox" checked={fullPage} onChange={(e) => setFullPage(e.target.checked)} className="peer sr-only" />
                    <span className="relative h-6 w-10 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 dark:bg-slate-700" />
                  </label>
                )}
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900">
                  <span className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg></span>
                    <span className="text-[13px] font-medium text-slate-900 dark:text-white">Dark mode</span>
                  </span>
                  <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} className="peer sr-only" />
                  <span className="relative h-6 w-10 rounded-full bg-slate-200 transition peer-checked:bg-indigo-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 dark:bg-slate-700" />
                </label>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{mode === "screenshot" ? "Full page scrolls & stitches • Dark emulates prefers-color-scheme" : "Dark mode emulates system theme"}</p>
            </div>
          </div>
        </form>
      </div>

      {/* Result chrome — preview is instant, tangible, Google Drive / Cloud Console quality */}
      {(loading || result || error) && (
        <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57] ring-1 ring-black/5" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e] ring-1 ring-black/5" />
              <span className="h-3 w-3 rounded-full bg-[#28c840] ring-1 ring-black/5" />
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
              <span className="w-full truncate font-mono text-xs text-slate-600 dark:text-slate-300">{submittedUrl || "Loading…"}</span>
            </div>
            {result && !loading && (
              <button onClick={handleDownload} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-600">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                Download {mode === "pdf" ? "PDF" : format.toUpperCase()}
              </button>
            )}
          </div>

          <div className="relative flex min-h-[380px] items-center justify-center bg-[#f8fafc] p-3 dark:bg-slate-900/50 sm:min-h-[440px]">
            {loading ? (
              <div className="flex flex-col items-center gap-4 py-16">
                <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-200 border-t-indigo-600" />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{loadingLabel}</p>
                  <p className="mt-1 text-xs text-slate-500">This usually takes 3–8 seconds • {width}px • {mode === "pdf" ? pdfFormat.toUpperCase() : format.toUpperCase()}</p>
                </div>
                <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full w-2/3 animate-[shimmer_1.2s_ease_infinite] rounded-full bg-indigo-600" /></div>
              </div>
            ) : result ? (
              result.kind === "pdf" ? (
                <iframe src={result.objectUrl} title="PDF preview" className="h-[600px] w-full rounded-xl bg-white shadow-inner" />
              ) : (
                <>
                  <img src={result.objectUrl} alt="Screenshot preview" className="max-h-[560px] w-full rounded-xl object-contain shadow-lg ring-1 ring-black/5" />
                  {isGuest && remaining !== null && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                        <span className="mr-2 h-2 w-2 rounded-full bg-emerald-500" /> {remaining} of {TOOL_GUEST_DAILY_LIMIT} free left today
                      </span>
                    </div>
                  )}
                </>
              )
            ) : error ? (
              <div className="w-full px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-400">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                </div>
                <p className="mx-auto mt-4 max-w-md text-sm font-medium text-red-700 dark:text-red-300" role="alert">{error}</p>
                <button onClick={() => setError(null)} className="mt-3 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-700">Dismiss</button>
              </div>
            ) : null}
          </div>
          {result && !loading && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
              <span className="font-mono">{width}px • {mode === "pdf" ? `PDF-${pdfFormat.toUpperCase()}` : format.toUpperCase()} • {darkMode ? "Dark" : "Light"} {mode !== "pdf" && fullPage ? "• Full page" : ""}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Ready to download</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
