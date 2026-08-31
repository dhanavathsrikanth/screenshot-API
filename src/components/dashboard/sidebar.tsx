"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUpgradeDialog } from "@/components/upgrade-dialog-provider";
import { getPlanBadgeClass, getPlanLabel } from "@/lib/plan-display";

const navigation = [
  {
    label: "General",
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
    label: "Develop",
    links: [
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
        label: "Projects",
        href: "/dashboard/projects",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3.75 3h12m-.75 4.5h.75m-.75 3h.75m-.75 3h.75" />
          </svg>
        ),
      },
      {
        label: "Webhooks",
        href: "/dashboard/webhooks",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        ),
      },
      {
        label: "Quick Start",
        href: "/dashboard/quickstart",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: "Account",
    links: [
      {
        label: "Plan & Billing",
        href: "/dashboard/plan",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
        ),
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        ),
      },
    ],
  },
];

const adminLink = {
  label: "Admin",
  href: "/dashboard/admin",
  icon: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
    </svg>
  ),
};

function SidebarContent({
  onLinkClick,
  plan,
  isAdmin,
}: {
  onLinkClick?: () => void;
  plan?: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const { openUpgradeDialog } = useUpgradeDialog();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const adminActive = isAdmin && isActive(adminLink.href);

  const linkBase =
    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all";
  const linkActive = "bg-orange-500/10 text-orange-600";
  const linkInactive = "text-[var(--dim)] hover:bg-[var(--muted)] hover:text-[var(--ink)]";
  const iconActive = "text-orange-500";
  const iconInactive = "text-[var(--dim)]";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((section, sectionIndex) => (
          <div key={section.label}>
            {sectionIndex > 0 && (
              <div className="my-4 border-t border-[var(--border)]" />
            )}
            <nav className="space-y-1">
              <p className="section-title px-3 mb-2">{section.label}</p>
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onLinkClick}
                  className={`${linkBase} ${
                    isActive(link.href) ? linkActive : linkInactive
                  }`}
                >
                  <span className={isActive(link.href) ? iconActive : iconInactive}>
                    {link.icon}
                  </span>
                  {link.label}
                  {link.href === "/dashboard/plan" && plan === "free" && (
                    <span className="ml-auto text-[10px] font-bold text-orange-600 bg-orange-500/10 px-1.5 py-0.5 rounded">
                      UPGRADE
                    </span>
                  )}
                </Link>
              ))}
              {section.label === "Account" && isAdmin && (
                <Link
                  href={adminLink.href}
                  onClick={onLinkClick}
                  className={`${linkBase} ${
                    adminActive ? linkActive : linkInactive
                  }`}
                >
                  <span className={adminActive ? iconActive : iconInactive}>
                    {adminLink.icon}
                  </span>
                  {adminLink.label}
                </Link>
              )}
            </nav>
          </div>
        ))}
      </div>

      {/* Bottom section: Plan badge + Upgrade button */}
      <div className="border-t border-[var(--border)] bg-[var(--muted)]/50 p-3 space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="section-title">Plan</span>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getPlanBadgeClass(plan)}`}>
            {getPlanLabel(plan)}
          </span>
        </div>
        {(!plan || plan === "free") && (
          <button
            onClick={() => { openUpgradeDialog(); onLinkClick?.(); }}
            className="btn-primary w-full"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Upgrade to Starter — $9
          </button>
        )}
        {plan && plan !== "free" && (
          <Link
            href="/dashboard/plan"
            onClick={onLinkClick}
            className="btn-secondary w-full"
          >
            View Plans
          </Link>
        )}
      </div>
    </div>
  );
}

export function DashboardSidebar({ plan, isAdmin }: { plan?: string; isAdmin?: boolean }) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r border-[var(--border)] bg-[var(--background)] lg:fixed lg:inset-y-0 lg:top-14 z-30 overflow-hidden">
      <div className="flex h-14 items-center border-b border-[var(--border)] px-5 flex-shrink-0">
        <Link href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-600 text-white">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </span>
          ScreenshotAPI
        </Link>
      </div>
      <SidebarContent plan={plan} isAdmin={isAdmin} />
    </aside>
  );
}

export function MobileSidebarButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-orange-600 text-white shadow-lg hover:bg-orange-700 transition-colors"
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
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  plan?: string;
  isAdmin?: boolean;
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
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-[var(--background)] border-r border-[var(--border)] transform transition-transform duration-200 ease-in-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-14 flex-shrink-0 border-b border-[var(--border)]">
          <span className="text-base font-bold tracking-tight text-[var(--ink)]">ScreenshotAPI</span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--dim)] hover:text-[var(--ink)] hover:bg-[var(--muted)] transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <SidebarContent onLinkClick={onClose} plan={plan} isAdmin={isAdmin} />
      </div>
    </>
  );
}
