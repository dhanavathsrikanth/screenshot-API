import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUsageStats, getUserProfile } from "@/app/actions/usage";
import { listApiKeys } from "@/app/actions/api-keys";
import { StatsCard, UsageBar } from "@/components/dashboard/stats-card";

type UserProfile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  created_at: string;
} | null;

type Stats = {
  plan: string;
  monthlyUsed: number;
  monthlyLimit: number;
  cacheHitRate: number;
  totalCalls: number;
};

function ScreenshotIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
    </svg>
  );
}

function ApiCallIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
    </svg>
  );
}

function CacheIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}

const planLabels: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

const quickLinks = [
  {
    label: "Quick Start",
    description: "Code snippets to get started",
    href: "/dashboard/quickstart",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    label: "Playground",
    description: "Try the screenshot API live",
    href: "/dashboard/playground",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
      </svg>
    ),
  },
  {
    label: "API Keys",
    description: "Manage your API keys",
    href: "/dashboard/api-keys",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
      </svg>
    ),
  },
  {
    label: "History",
    description: "View recent screenshots",
    href: "/dashboard/history",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let stats: Stats;
  let profile: UserProfile;
  let keyCount: number;

  try {
    [stats, profile, keyCount] = await Promise.all([
      getUsageStats(userId),
      getUserProfile(userId),
      listApiKeys().then((keys) => keys.length),
    ]);
  } catch {
    stats = { plan: "free", monthlyUsed: 0, monthlyLimit: 100, cacheHitRate: 0, totalCalls: 0 };
    profile = null;
    keyCount = 0;
  }

  const displayName = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email
    : "User";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {profile?.image_url && (
            <img
              src={profile.image_url}
              alt=""
              className="w-12 h-12 rounded-full ring-2 ring-[var(--border)]"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm text-zinc-500">{profile?.email}</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
          {planLabels[stats.plan] ?? stats.plan}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <StatsCard
            label="Screenshots This Month"
            value={stats.monthlyUsed.toLocaleString()}
            sublabel={`${stats.monthlyLimit.toLocaleString()} monthly limit`}
            icon={<ScreenshotIcon />}
            accent
          />
          <div className="px-6 pt-1">
            <UsageBar used={stats.monthlyUsed} limit={stats.monthlyLimit} />
          </div>
        </div>
        <StatsCard
          label="Total API Calls"
          value={stats.totalCalls.toLocaleString()}
          sublabel="Last 30 days"
          icon={<ApiCallIcon />}
        />
        <StatsCard
          label="Cache Hit Rate"
          value={`${stats.cacheHitRate}%`}
          sublabel={stats.cacheHitRate >= 50 ? "Great efficiency" : "Warming up"}
          icon={<CacheIcon />}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-4 rounded-xl border border-[var(--border)] p-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors group"
            >
              <div className="flex-shrink-0 p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {link.icon}
              </div>
              <div>
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs text-zinc-500">{link.description}</p>
              </div>
              <svg className="ml-auto h-4 w-4 text-zinc-400 group-hover:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {keyCount === 0 && (
        <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-6">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                No API keys yet
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Create an API key to start using the screenshot API programmatically.
              </p>
              <Link
                href="/dashboard/api-keys"
                className="inline-block mt-2 text-xs font-medium text-amber-800 dark:text-amber-300 underline underline-offset-2 hover:no-underline"
              >
                Create your first key &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
