"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useUpgradeDialog } from "@/components/upgrade-dialog-provider";

const navigation = [
  {
    label: "Dashboard",
    links: [
      {
        label: "Overview",
        href: "/dashboard",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          </svg>
        ),
      },
      {
        label: "Analytics",
        href: "/dashboard/analytics",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
          </svg>
        ),
      },
      {
        label: "API Tracking",
        href: "/dashboard/tracking",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
        ),
      },
      {
        label: "API Keys",
        href: "/dashboard/api-keys",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
          </svg>
        ),
      },
      {
        label: "Plan & Usage",
        href: "/dashboard/plan",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
        ),
      },
      {
        label: "SLA Monitor",
        href: "/dashboard/sla",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
        ),
      },
      {
        label: "History",
        href: "/dashboard/history",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Tools",
    links: [
      {
        label: "Quick Start",
        href: "/dashboard/quickstart",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      },
      {
        label: "Playground",
        href: "/dashboard/playground",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
          </svg>
        ),
      },
    ],
  },
];

function SidebarContent({ onLinkClick, plan }: { onLinkClick?: () => void; plan?: string }) {
  const pathname = usePathname();
  const { openUpgradeDialog } = useUpgradeDialog();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const planLabels: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", business: "Business" };
  const planColors: Record<string, string> = {
    free: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    starter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    pro: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    business: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((section, sectionIndex) => (
          <div key={section.label}>
            {sectionIndex > 0 && (
              <div className="my-3 border-t border-zinc-200 dark:border-zinc-800" />
            )}
            <nav className="space-y-0.5">
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {section.label}
              </p>
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onLinkClick}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    isActive(link.href)
                      ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  <span className={isActive(link.href) ? "text-indigo-500 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500"}>
                    {link.icon}
                  </span>
                  {link.label}
                  {link.href === "/dashboard/plan" && plan === "free" && (
                    <span className="ml-auto text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                      UPGRADE
                    </span>
                  )}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* Bottom section: Plan badge + Upgrade button */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Plan</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${planColors[plan ?? "free"]}`}>
            {planLabels[plan ?? "free"] ?? "Free"}
          </span>
        </div>
        {(!plan || plan === "free") && (
          <button
            onClick={() => { openUpgradeDialog(); onLinkClick?.(); }}
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Upgrade Plan
          </button>
        )}
        {plan && plan !== "free" && plan !== "business" && (
          <Link
            href="/dashboard/plan"
            onClick={onLinkClick}
            className="flex items-center justify-center gap-2 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
          >
            View Plans
          </Link>
        )}
      </div>
    </div>
  );
}

export function DashboardSidebar({ plan }: { plan?: string }) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 lg:fixed lg:inset-y-0 lg:top-14 z-30 overflow-hidden">
      <SidebarContent plan={plan} />
    </aside>
  );
}

export function MobileSidebarButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors"
      aria-label="Open menu"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>
  );
}

export function MobileSidebar({
  open,
  onClose,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  plan?: string;
}) {
  return (
    <>
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800">
          <span className="text-lg font-bold gradient-text">ScreenTool</span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <SidebarContent onLinkClick={onClose} plan={plan} />
      </div>
    </>
  );
}
