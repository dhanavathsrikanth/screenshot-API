"use client";

import { useUpgradeDialog } from "@/components/upgrade-dialog-provider";

export function UpgradeButton({
  variant = "primary",
  className = "",
}: {
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { openUpgradeDialog } = useUpgradeDialog();

  if (variant === "secondary") {
    return (
      <button
        onClick={openUpgradeDialog}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${className}`}
      >
        Manage Plan
      </button>
    );
  }

  return (
    <button
      onClick={openUpgradeDialog}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--primary-hover)] transition-colors shadow-sm ${className}`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
      Upgrade to Starter — $9
    </button>
  );
}
