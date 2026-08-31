"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function BillingStatusBanners() {
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded");
  const credits = searchParams.get("credits");
  const cancelled = searchParams.get("cancelled");

  const [dismissed, setDismissed] = useState<string | null>(null);

  if (cancelled && dismissed !== "cancelled") {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg className="h-5 w-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Checkout was cancelled</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">No charges were made. You can try again anytime.</p>
          </div>
        </div>
        <button
          onClick={() => {
            setDismissed("cancelled");
            window.history.replaceState({}, "", "/dashboard/plan");
          }}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  if (credits && dismissed !== "credits") {
    return (
      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/50">
            <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Credit top-up successful!</p>
            <p className="text-xs text-green-600 dark:text-green-400">
              Your credits are being added. Refresh if your balance hasn&apos;t updated yet.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setDismissed("credits");
            window.history.replaceState({}, "", "/dashboard/plan");
            window.location.reload();
          }}
          className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  if (!upgraded || dismissed === "upgraded") return null;

  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/50">
          <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-green-800 dark:text-green-200">Payment successful!</p>
          <p className="text-xs text-green-600 dark:text-green-400">
            Your plan is being activated. This may take a moment to reflect.
          </p>
        </div>
      </div>
      <button
        onClick={() => {
          setDismissed("upgraded");
          window.history.replaceState({}, "", "/dashboard/plan");
          window.location.reload();
        }}
        className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function UpgradeSuccessBanner() {
  return <BillingStatusBanners />;
}
