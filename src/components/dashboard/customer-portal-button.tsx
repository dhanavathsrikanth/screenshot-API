"use client";

import { useState } from "react";

export function CustomerPortalButton({
  hasCustomer,
  variant = "primary",
}: {
  hasCustomer: boolean;
  variant?: "primary" | "secondary";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    if (!hasCustomer) return;
    setLoading(true);
    setError(null);
    try {
      // Hit the portal route - it will 302 to Dodo hosted portal
      window.location.assign("/customer-portal");
    } catch {
      setError("Unable to open portal");
      setLoading(false);
    }
  }

  if (!hasCustomer) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--muted)] px-3.5 py-2 text-sm font-medium text-[var(--dim)] cursor-not-allowed"
        title="No billing profile yet"
      >
        Manage billing
      </span>
    );
  }

  const base =
    variant === "primary"
      ? "bg-[var(--ink)] text-white hover:bg-black dark:hover:bg-zinc-800"
      : "border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--ink)]";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={openPortal}
        disabled={loading}
        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${base}`}
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Opening...
          </>
        ) : (
          <>
            Manage billing
            <svg className="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H12a.75.75 0 0 0-.75.75v5.59l-.72-.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l2-2a.75.75 0 1 0-1.06-1.06l-.72.72V6.75A.75.75 0 0 0 13.5 6Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" />
            </svg>
          </>
        )}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export function CustomerPortalLink({ hasCustomer }: { hasCustomer: boolean }) {
  if (!hasCustomer) return null;
  return (
    <a
      href="/customer-portal"
      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4"
    >
      Invoices & subscription
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </a>
  );
}
