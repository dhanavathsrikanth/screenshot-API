"use client";

import { useState, useTransition } from "react";
import { setOverageEnabled } from "@/app/actions/billing";

export function OverageToggle({
  enabled,
  plan,
}: {
  enabled: boolean;
  plan: string;
}) {
  const [value, setValue] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isPaid = plan !== "free";

  if (!isPaid) {
    return (
      <div className="card p-5">
        <p className="text-sm font-semibold">Overage</p>
        <p className="mt-1 text-xs text-[var(--dim)]">
          Paid plans only. <a href="/docs#pricing" className="underline hover:text-[var(--ink)]">Docs</a>
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Overage</p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            Continue past limit, billed per extra. <a href="/docs#pricing" className="underline hover:text-[var(--ink)]">Docs</a>
          </p>
          {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const next = !value;
            setError(null);
            startTransition(async () => {
              try {
                await setOverageEnabled(next);
                setValue(next);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to update overage setting.");
              }
            });
          }}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            value ? "bg-orange-600" : "bg-[var(--line)]"
          } ${isPending ? "opacity-60" : ""}`}
          aria-pressed={value}
          aria-label="Toggle overage billing"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p className="mt-3 text-[11px] text-[var(--dim)]">
        {value ? "On" : "Off"} · {value ? "overages allowed" : "hard stop"}
      </p>
    </div>
  );
}
