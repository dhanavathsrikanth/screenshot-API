"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { useUpgradeDialog } from "@/components/upgrade-dialog-provider";

export function DashboardTopNav({ plan }: { plan?: string }) {
  const { openUpgradeDialog } = useUpgradeDialog();
  const isFree = !plan || plan === "free";

  return (
    <nav className="sticky top-0 z-40 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold gradient-text">
            ScreenTool
          </Link>
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
            Dashboard
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isFree && (
            <button
              onClick={openUpgradeDialog}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              Upgrade
            </button>
          )}
          <Link
            href="/"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
            Home
          </Link>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8",
              },
            }}
          />
        </div>
      </div>
    </nav>
  );
}
