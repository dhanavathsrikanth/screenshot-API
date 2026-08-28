"use client";

import { useState, useTransition } from "react";
import { retryScreenshot } from "@/app/actions/jobs";

type RetryState = "idle" | "retrying" | "done" | "error";

export function RetryButton({ screenshotId }: { screenshotId: string }) {
  const [state, setState] = useState<RetryState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRetry() {
    setError(null);
    setState("retrying");
    startTransition(async () => {
      try {
        await retryScreenshot(screenshotId);
        setState("done");
        setTimeout(() => setState("idle"), 2500);
      } catch (err) {
        setState("error");
        setError(err instanceof Error ? err.message : "Failed to re-capture. Please try again.");
        setTimeout(() => setState("idle"), 4000);
      }
    });
  }

  if (state === "done") {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-400"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        Queued
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending || state === "retrying"}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        title={state === "error" && error ? error : "Re-capture this screenshot"}
      >
        {state === "retrying" ? (
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-zinc-400 border-t-transparent" />
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        )}
        <span>{state === "retrying" ? "Retrying…" : "Retry"}</span>
      </button>
      {state === "error" && (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
