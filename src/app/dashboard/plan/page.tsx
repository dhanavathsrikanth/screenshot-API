import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUsageStats, getUserProfile } from "@/app/actions/usage";
import { getUsageAlerts, acknowledgeAlert, getCostEstimation, getUsageForecast } from "@/app/actions/analytics";
import { getAllPlanLimits, type PlanId } from "@/lib/plans";
import { StatsCard, UsageBar } from "@/components/dashboard/stats-card";
import { UsageAlerts, UpgradePrompt, CostEstimation, UsageForecast } from "@/components/dashboard/charts";
import { UpgradeSuccessBanner } from "@/components/upgrade-success-banner";

const planLabels: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", business: "Business" };

function ScreenshotIcon() {
  return (<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>);
}

function CreditIcon() {
  return (<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>);
}

function UsedIcon() {
  return (<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>);
}

export default async function PlanPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  type UserProfile = {
    id: string; email: string | null; first_name: string | null; last_name: string | null;
    image_url: string | null; created_at: string; username: string | null;
    profile_image_url: string | null; has_image: boolean | null; locale: string | null;
    external_accounts: { provider: string; email_address: string }[] | null;
    password_enabled: boolean | null; two_factor_enabled: boolean | null;
    banned: boolean | null; locked: boolean | null;
    last_active_at: string | null; last_sign_in_at: string | null;
  } | null;

  let stats: { plan: string; monthlyUsed: number; monthlyLimit: number; creditBalance: number; creditsUsedThisCycle: number; creditsGrantedThisCycle: number; topUpBalance: number; overageEnabled: boolean; cacheHitRate: number; totalCalls: number };
  let profile: UserProfile;
  let costEst: any;
  let forecast: any;
  let alerts: any[];
  let allPlanLimits: { id: PlanId; limits: { monthlyScreenshots: number; apiKeys: number; rateLimitPerMinute: number; formats: string[]; adBlocking: boolean; cookieBlocking: boolean; cloudStorage: boolean; pdfExport: boolean } }[];

  try {
    [stats, profile, costEst, forecast, alerts, allPlanLimits] = await Promise.all([
      getUsageStats(userId),
      getUserProfile(userId),
      getCostEstimation(userId),
      getUsageForecast(userId),
      getUsageAlerts(userId),
      getAllPlanLimits(),
    ]);
  } catch {
    stats = { plan: "free", monthlyUsed: 0, monthlyLimit: 100, creditBalance: 0, creditsUsedThisCycle: 0, creditsGrantedThisCycle: 0, topUpBalance: 0, overageEnabled: false, cacheHitRate: 0, totalCalls: 0 };
    profile = null;
    costEst = { plan: "free", monthlyPrice: 0, monthlyUsed: 0, monthlyLimit: 100, computeCost: 0, storageCost: 0, totalEstimatedCost: 0, storageGB: 0, costPerScreenshot: 0, recommendedPlan: null };
    forecast = { forecast: [], dailyAvg: 0, monthlyUsed: 0, monthlyLimit: 100, daysUntilLimit: null };
    alerts = [];
    allPlanLimits = getAllPlanLimits();
  }

  const currentPlan = stats.plan as PlanId;

  const planIds: PlanId[] = ["free", "starter", "pro", "business"];

  const comparisonRows: { label: string; key: string; format: (limits: any) => string | boolean }[] = [
    { label: "Monthly Screenshots", key: "monthlyScreenshots", format: (l) => l.monthlyScreenshots.toLocaleString() },
    { label: "API Keys", key: "apiKeys", format: (l) => l.apiKeys },
    { label: "Rate Limit", key: "rateLimitPerMinute", format: (l) => `${l.rateLimitPerMinute} req/min` },
    { label: "Formats", key: "formats", format: (l) => l.formats.join(", ").toUpperCase() },
    { label: "Ad Blocking", key: "adBlocking", format: (l) => l.adBlocking },
    { label: "Cookie Blocking", key: "cookieBlocking", format: (l) => l.cookieBlocking },
    { label: "Cloud Storage", key: "cloudStorage", format: (l) => l.cloudStorage },
    { label: "PDF Export", key: "pdfExport", format: (l) => l.pdfExport },
  ];

  const planLimitsMap: Record<PlanId, any> = {} as any;
  for (const p of allPlanLimits) planLimitsMap[p.id] = p.limits;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Plan & Usage</h1>
        <p className="text-sm text-zinc-500 mt-1">Monitor your usage, quotas, and plan limits</p>
      </div>

      <Suspense>
        <UpgradeSuccessBanner />
      </Suspense>

      <div>
        <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <StatsCard
              label="Screenshots Used This Month"
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
            label="Credits Remaining"
            value={stats.creditBalance.toLocaleString()}
            sublabel={`${stats.creditsGrantedThisCycle.toLocaleString()} granted this cycle`}
            icon={<CreditIcon />}
          />
          <StatsCard
            label="Credits Used This Cycle"
            value={stats.creditsUsedThisCycle.toLocaleString()}
            sublabel={stats.topUpBalance > 0 ? `+${stats.topUpBalance.toLocaleString()} top-up balance` : undefined}
            icon={<UsedIcon />}
          />
          <div className="flex items-center">
            <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {planLabels[stats.plan] ?? stats.plan} Plan
            </span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Cost Estimation</h2>
        <CostEstimation data={costEst} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Usage Forecast</h2>
        <UsageForecast data={forecast} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Usage Alerts</h2>
        <UsageAlerts data={alerts} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Upgrade</h2>
        <UpgradePrompt data={{ plan: stats.plan, monthlyUsed: stats.monthlyUsed, monthlyLimit: stats.monthlyLimit, recommendedPlan: costEst.recommendedPlan }} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Plan Comparison</h2>
        <div className="rounded-xl border border-[var(--border)] p-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 pr-4 text-zinc-500 font-medium">Feature</th>
                {planIds.map((pid) => (
                  <th
                    key={pid}
                    className={`text-center py-3 px-4 font-medium ${
                      pid === currentPlan
                        ? "text-indigo-600 dark:text-indigo-400 border-2 border-indigo-500/50 rounded-lg"
                        : "text-zinc-500"
                    }`}
                  >
                    {planLabels[pid]}
                    {pid === currentPlan && (
                      <span className="ml-1 text-[10px] text-indigo-500">(current)</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 pr-4 text-zinc-500">{row.label}</td>
                  {planIds.map((pid) => {
                    const val = row.format(planLimitsMap[pid]);
                    const isCurrent = pid === currentPlan;
                    return (
                      <td
                        key={pid}
                        className={`text-center py-3 px-4 ${
                          isCurrent ? "border-2 border-indigo-500/50 rounded-lg" : ""
                        }`}
                      >
                        {typeof val === "boolean" ? (
                          val ? (
                            <span className="text-green-500 font-semibold">✓</span>
                          ) : (
                            <span className="text-zinc-300 dark:text-zinc-600">✗</span>
                          )
                        ) : (
                          <span className={isCurrent ? "font-medium" : ""}>{String(val)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
