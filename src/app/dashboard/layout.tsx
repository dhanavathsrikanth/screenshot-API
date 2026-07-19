"use client";

import { useState } from "react";
import {
  DashboardSidebar,
  MobileSidebarButton,
  MobileSidebar,
} from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <DashboardSidebar />
      <MobileSidebarButton onClick={() => setMobileOpen(true)} />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </div>
  );
}
