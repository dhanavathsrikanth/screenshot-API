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

export function ToolCapture({ mode }: { mode: ToolMode }) {
  const { isSignedIn } = useAuth();
  const [clientId] = useState(getOrCreateClientId);
  const [url, setUrl] = useState("https://example.com");
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
    mode === "pdf" ? (loading ? "Generating..." : "Generate PDF") : mode === "fullpage" ? (loading ? "Capturing..." : "Capture Full Page") : loading ? "Capturing..." : "Take Screenshot";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const payload: Record<string, unknown> = {
      url,
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
          message = err.error ?? message;
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
    "rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div>
      {isGuest && (
        <div className="mb-6 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 px-4 py-3 text-sm text-indigo-700 dark:text-indigo-300">
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex gap-3">
          <label htmlFor="tool-url" className="sr-only">
            Website URL
          </label>
          <input
            id="tool-url"
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
            {buttonLabel}
          </button>
        </div>

        <fieldset className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <legend className="sr-only">Capture options</legend>

          {mode === "pdf" ? (
            <div>
              <label htmlFor="pdf-format" className="block text-zinc-500 mb-1 text-sm">
                Page size
              </label>
              <select
                id="pdf-format"
                value={pdfFormat}
                onChange={(e) => setPdfFormat(e.target.value as typeof pdfFormat)}
                className={`w-full ${inputClass}`}
              >
                <option value="a4">A4</option>
                <option value="letter">Letter</option>
                <option value="legal">Legal</option>
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="image-format" className="block text-zinc-500 mb-1 text-sm">
                Format
              </label>
              <select
                id="image-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className={`w-full ${inputClass}`}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="viewport-width" className="block text-zinc-500 mb-1 text-sm">
              Viewport width
            </label>
            <input
              id="viewport-width"
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              min={320}
              max={3840}
              className={`w-full ${inputClass}`}
            />
          </div>

          {mode === "screenshot" && (
            <label className="flex items-end gap-2 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={fullPage}
                onChange={(e) => setFullPage(e.target.checked)}
                className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-zinc-500">Full page</span>
            </label>
          )}

          <label className="flex items-end gap-2 cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-zinc-500">Dark mode</span>
          </label>
        </fieldset>
      </form>

      {error && (
        <div className="mt-6 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4" role="alert">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 rounded-lg border border-[var(--border)] overflow-hidden">
          <div className="bg-zinc-50 dark:bg-zinc-900 px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">Preview</span>
              {isGuest && remaining !== null && (
                <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 ring-1 ring-inset ring-indigo-600/20">
                  {remaining} of {TOOL_GUEST_DAILY_LIMIT} free captures left today
                </span>
              )}
            </div>
            <button onClick={handleDownload} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              Download {mode === "pdf" ? "PDF" : "screenshot"}
            </button>
          </div>
          {result.kind === "pdf" ? (
            <iframe src={result.objectUrl} title="PDF preview" className="h-[600px] w-full bg-white" />
          ) : (
            <img
              src={result.objectUrl}
              alt="Screenshot preview"
              className="w-full max-h-[500px] object-contain bg-zinc-50 dark:bg-zinc-900"
            />
          )}
        </div>
      )}

      {!result && !error && !loading && (
        <div className="mt-6 rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <p className="text-sm text-zinc-500">
            {mode === "pdf"
              ? "Enter a URL and click Generate PDF to convert any webpage into a PDF."
              : "Enter a URL and click the button to see the result here."}
          </p>
        </div>
      )}
    </div>
  );
}
