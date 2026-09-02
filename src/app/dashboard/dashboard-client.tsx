"use client";

import { useState } from "react";
import {
  DashboardSidebar,
  MobileSidebar,
} from "@/components/dashboard/sidebar";
import { UpgradeDialogProvider } from "@/components/upgrade-dialog-provider";
import { DataAccessBanner } from "@/components/dashboard/data-access-banner";
import type { DashboardAccessStatus } from "@/app/actions/dashboard-access";

export function DashboardLayoutClient({
  children,
  plan,
  currentProductId,
  isAdmin,
  dataAccess,
}: {
  children: React.ReactNode;
  plan: string;
  currentProductId?: string;
  isAdmin: boolean;
  dataAccess: DashboardAccessStatus;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <UpgradeDialogProvider currentPlan={plan} currentProductId={currentProductId}>
      <div className="flex min-h-screen bg-[var(--background)]">
        <DashboardSidebar plan={plan} isAdmin={isAdmin} />

        <MobileSidebar
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          plan={plan}
          isAdmin={isAdmin}
        />

        {/* Mobile top bar — minimal, not fixed */}
        <div className="flex flex-1 flex-col lg:pl-64 min-w-0">
          <header className="flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-4 lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--ink)]"
              aria-label="Open navigation"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <span className="text-sm font-bold tracking-tight">ScreenshotAPI</span>
            <span className="h-9 w-9" aria-hidden />
          </header>

          <main className="flex-1">
            <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
              <DataAccessBanner status={dataAccess} />
              <div className="dashboard-page">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </UpgradeDialogProvider>
  );
}
