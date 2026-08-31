"use client";

import { useState } from "react";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import {
  DashboardSidebar,
  MobileSidebarButton,
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
      <DashboardTopNav plan={plan} />

      <div className="relative min-h-[calc(100vh-3.5rem)]">
        <DashboardSidebar plan={plan} isAdmin={isAdmin} />
        <MobileSidebarButton onClick={() => setMobileOpen(true)} />
        <MobileSidebar
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          plan={plan}
          isAdmin={isAdmin}
        />

        <div className="lg:pl-64">
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <DataAccessBanner status={dataAccess} />
            <div className="dashboard-page">{children}</div>
          </div>
        </div>
      </div>
    </UpgradeDialogProvider>
  );
}
