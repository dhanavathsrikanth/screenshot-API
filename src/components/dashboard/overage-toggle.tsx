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
      <div className="card p-4">
        <p className="text-sm font-medium">Overage billing</p>
        <p className="mt-1 text-xs text-[var(--dim)]">
          Upgrade to a paid plan to keep capturing after you hit your monthly limit. Extra renders bill at your plan&apos;s overage rate.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Overage billing</p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            When enabled, captures continue after your monthly limit and bill at your plan&apos;s overage rate instead of stopping.
          </p>
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
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
      <p className="mt-2 text-[11px] text-[var(--dim)]">
        Status: <span className="font-medium text-[var(--ink)]">{value ? "On — overages allowed" : "Off — hard stop at limit"}</span>
      </p>
    </div>
  );
}
