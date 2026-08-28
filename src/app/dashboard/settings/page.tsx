import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SettingsProfile } from "@/components/dashboard/settings-profile";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Account Settings"
        description="Manage your profile and account preferences"
      />

      {/* Profile */}
      <SettingsProfile />

      {/* Shortcuts to related areas (each has its own dedicated page) */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 dark:bg-[var(--card)]">
        <h2 className="text-sm font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Related settings</h2>
        <p className="mt-1 text-xs text-[var(--dim)] dark:text-[var(--dim)]">
          These live on their own pages:
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              href: "/dashboard/plan",
              title: "Plan & Billing",
              desc: "Subscription, credits, invoices",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              ),
            },
            {
              href: "/dashboard/api-keys",
              title: "API Keys",
              desc: "Create, revoke, and scope keys",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              ),
            },
            {
              href: "/dashboard/projects",
              title: "Projects",
              desc: "Organize keys and usage per app",
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3.75 3h12m-.75 4.5h.75m-.75 3h.75m-.75 3h.75" />
              ),
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card card-lift flex items-start gap-3 p-4 group"
            >
              <div className="h-9 w-9 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  {item.icon}
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-[var(--dim)] dark:text-[var(--dim)]">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
