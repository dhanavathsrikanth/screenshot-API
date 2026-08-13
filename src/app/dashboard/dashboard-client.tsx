"use client";

import { useState } from "react";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import {
  DashboardSidebar,
  MobileSidebarButton,
  MobileSidebar,
} from "@/components/dashboard/sidebar";
import { UpgradeDialogProvider } from "@/components/upgrade-dialog-provider";

export function DashboardLayoutClient({
  children,
  plan,
  isAdmin,
}: {
  children: React.ReactNode;
  plan: string;
  isAdmin: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <UpgradeDialogProvider currentPlan={plan}>
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
            {children}
          </div>
        </div>
      </div>
    </UpgradeDialogProvider>
  );
}
