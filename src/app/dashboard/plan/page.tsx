import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUsageStats } from "@/app/actions/usage";
import { getUsageAlerts, acknowledgeAlert, getCostEstimation } from "@/app/actions/analytics";
import { reconcilePlanAfterCheckout } from "@/app/actions/billing";
import { getAllPlanLimits, type PlanId } from "@/lib/plans";
import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { StatsCard, UsageBar } from "@/components/dashboard/stats-card";
import { UsageAlerts, UpgradePrompt } from "@/components/dashboard/charts";
import { UpgradeSuccessBanner } from "@/components/upgrade-success-banner";
import { BuyCredits } from "@/components/dashboard/buy-credits";
import { PageHeader } from "@/components/dashboard/page-header";

const planLabels: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", scale: "Scale" };

type PaymentListRow = {
  payment_id: string;
  created_at: string;
  currency: string;
  total_amount: number;
  status?: string | null;
  invoice_id?: string | null;
  invoice_url?: string | null;
};

const ZERO_DEC = new Set(["JPY", "KRW"]);
const THREE_DEC = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

function formatAmount(minorUnits: number, currency: string) {
  let divisor = 100;
  if (ZERO_DEC.has(currency)) divisor = 1;
  else if (THREE_DEC.has(currency)) divisor = 1000;
  const value = minorUnits / divisor;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(divisor === 1000 ? 3 : divisor === 1 ? 0 : 2)} ${currency}`;
  }
}

async function fetchRecentPayments(customerId: string | null): Promise<PaymentListRow[]> {
  if (!customerId) return [];
  try {
    const cfg = getDodoConfig();
    const client = new DodoPayments({
      bearerToken: cfg.apiKey,
      environment: cfg.environment as "test_mode" | "live_mode",
    });
    const payments: PaymentListRow[] = [];
    for await (const p of client.payments.list({
      customer_id: customerId,
      status: "succeeded",
      page_size: 10,
      page_number: 1,
    })) {
      payments.push({
        payment_id: p.payment_id,
        created_at: p.created_at,
        currency: p.currency,
        total_amount: p.total_amount,
        status: p.status ?? null,
        invoice_id: p.invoice_id ?? null,
        invoice_url: p.invoice_url ?? null,
      });
    }
    return payments;
  } catch {
    return [];
  }
}

function ScreenshotIcon() {
  return (<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>);
}

function CreditIcon() {
  return (<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>);
}

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // The user just came back from a successful Dodo checkout. The webhook is the
  // primary plan writer, but reconcile as a backstop in case it was missed or
  // failed to map the product. Idempotent; clears the pending markers on success.
  const params = await searchParams;
  if (params.upgraded === "1" || params.upgraded === "true") {
    try {
      await reconcilePlanAfterCheckout(userId);
    } catch (err) {
      console.error("[plan] post-checkout reconciliation failed:", err);
    }
  }

  type PlanLimits = {
    monthlyScreenshots: number;
    apiKeys: number;
    rateLimitPerMinute: number;
    formats: string[];
    adBlocking: boolean;
    cookieBlocking: boolean;
    trackerBlocking: boolean;
    pdfExport: boolean;
    fullPage: boolean;
    elementCapture: boolean;
    geoTargeting: boolean;
    videoCapture: boolean;
    maxVideoSeconds: number;
  };

  type CostEstimationData = {
    plan: string;
    monthlyPrice: number;
    monthlyUsed: number;
    monthlyLimit: number;
    computeCost: number;
    storageCost: number;
    totalEstimatedCost: number;
    storageGB: number;
    costPerScreenshot: number;
    recommendedPlan: string | null;
  };

  let stats: { plan: string; monthlyUsed: number; monthlyLimit: number; creditBalance: number; creditsUsedThisCycle: number; creditsGrantedThisCycle: number; topUpBalance: number; overageEnabled: boolean };
  let costEst: CostEstimationData;
  let alerts: { id: string; alert_type: string; threshold_pct: number; triggered_at: string; acknowledged: boolean }[];
  let allPlanLimits: { id: PlanId; limits: PlanLimits }[];
  let customerId: string | null = null;
  let payments: PaymentListRow[] = [];

  try {
    [stats, costEst, alerts, allPlanLimits] = await Promise.all([
      getUsageStats(userId),
      getCostEstimation(userId),
      getUsageAlerts(userId),
      getAllPlanLimits(),
    ]);
  } catch {
    stats = { plan: "free", monthlyUsed: 0, monthlyLimit: 100, creditBalance: 0, creditsUsedThisCycle: 0, creditsGrantedThisCycle: 0, topUpBalance: 0, overageEnabled: false };
    costEst = { plan: "free", monthlyPrice: 0, monthlyUsed: 0, monthlyLimit: 100, computeCost: 0, storageCost: 0, totalEstimatedCost: 0, storageGB: 0, costPerScreenshot: 0, recommendedPlan: null };
    alerts = [];
    allPlanLimits = getAllPlanLimits();
  }

  // Billing history (from Dodo). Non-fatal if it fails.
  try {
    const supabase = await createClient();
    const { data: userRow } = await supabase
      .from("users")
      .select("dodo_customer_id")
      .eq("id", userId)
      .maybeSingle();
    customerId = userRow?.dodo_customer_id ?? null;
    payments = await fetchRecentPayments(customerId);
  } catch {
    // leave defaults
  }

  void acknowledgeAlert; // revalidate target for UsageAlerts' ack action

  const currentPlan = stats.plan as PlanId;

  const planIds: PlanId[] = ["free", "starter", "pro", "scale"];

  const comparisonRows: { label: string; key: string; format: (limits: PlanLimits) => string | number | boolean }[] = [
    { label: "Monthly Screenshots", key: "monthlyScreenshots", format: (l) => l.monthlyScreenshots.toLocaleString() },
    { label: "API Keys", key: "apiKeys", format: (l) => l.apiKeys },
    { label: "Rate Limit", key: "rateLimitPerMinute", format: (l) => `${l.rateLimitPerMinute} req/min` },
    { label: "Formats", key: "formats", format: (l) => l.formats.join(", ").toUpperCase() },
    { label: "Ad Blocking", key: "adBlocking", format: (l) => l.adBlocking },
    { label: "Cookie Blocking", key: "cookieBlocking", format: (l) => l.cookieBlocking },
    { label: "Tracker Blocking", key: "trackerBlocking", format: (l) => l.trackerBlocking },
    { label: "Element Capture", key: "elementCapture", format: (l) => l.elementCapture },
    { label: "Full Page", key: "fullPage", format: (l) => l.fullPage },
    { label: "PDF Export", key: "pdfExport", format: (l) => l.pdfExport },
    { label: "Geo Targeting", key: "geoTargeting", format: (l) => l.geoTargeting },
    { label: "Video / GIF Capture", key: "videoCapture", format: (l) => l.videoCapture },
  ];

  const planLimitsMap: Record<PlanId, PlanLimits> = {} as Record<PlanId, PlanLimits>;
  for (const p of allPlanLimits) planLimitsMap[p.id] = p.limits;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Plan & Billing"
        title="Plan, Credits & Invoices"
        description="Manage your subscription, credits, and billing history"
        actions={
          customerId ? (
            <a
              href={`/customer-portal?customer_id=${encodeURIComponent(customerId)}`}
              className="btn-secondary"
            >
              Customer Portal
            </a>
          ) : undefined
        }
      />

      <Suspense>
        <UpgradeSuccessBanner />
      </Suspense>

      <div>
        <h2 className="eyebrow text-zinc-400 mb-4">Current Plan</h2>
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
            sublabel={stats.plan === "free" ? "Lifetime allocation" : `${stats.creditsGrantedThisCycle.toLocaleString()} granted this cycle`}
            icon={<CreditIcon />}
          />
          <StatsCard
            label="Credits Used This Cycle"
            value={stats.creditsUsedThisCycle.toLocaleString()}
            sublabel={
              stats.plan === "free"
                ? `Total allocation: ${(stats.creditsGrantedThisCycle + stats.topUpBalance).toLocaleString()}`
                : stats.topUpBalance > 0
                  ? `+${stats.topUpBalance.toLocaleString()} top-up balance`
                  : undefined
            }
            icon={<CreditIcon />}
          />
          <div className="flex items-center">
            <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {planLabels[stats.plan] ?? stats.plan} Plan
            </span>
          </div>
        </div>
      </div>

      <div>
        <h2 className="eyebrow text-zinc-400 mb-4">Usage Alerts</h2>
        <UsageAlerts data={alerts} />
      </div>

      <div>
        <h2 className="eyebrow text-zinc-400 mb-4">Upgrade</h2>
        <UpgradePrompt data={{ plan: stats.plan, monthlyUsed: stats.monthlyUsed, monthlyLimit: stats.monthlyLimit, recommendedPlan: costEst.recommendedPlan }} />
      </div>

      <div>
        <h2 className="eyebrow text-zinc-400 mb-4">Buy Credit Top-Ups</h2>
        <BuyCredits />
      </div>

      <div>
        <h2 className="eyebrow text-zinc-400 mb-4">Billing History</h2>
        {!customerId && (
          <div className="card card-lift border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 mb-4">
            <p className="text-sm text-indigo-800 dark:text-indigo-200">
              No billing profile yet. Complete a checkout to create one — invoices will appear here.
            </p>
          </div>
        )}
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-zinc-500 uppercase text-xs">
                <th className="text-left py-3 px-4 font-medium">Date</th>
                <th className="text-left py-3 px-4 font-medium">Amount</th>
                <th className="text-left py-3 px-4 font-medium">Status</th>
                <th className="text-left py-3 px-4 font-medium">Invoice</th>
                <th className="text-left py-3 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td className="py-6 px-4 text-zinc-500" colSpan={5}>
                    {customerId ? "No payments found." : "Billing history will appear here after your first purchase."}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.payment_id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 px-4">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="py-3 px-4">{formatAmount(p.total_amount, p.currency)}</td>
                    <td className="py-3 px-4">{(p.status ?? "succeeded").toString()}</td>
                    <td className="py-3 px-4">{p.invoice_id ?? "-"}</td>
                    <td className="py-3 px-4">
                      {p.invoice_url ? (
                        <a
                          href={p.invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-zinc-400">N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="eyebrow text-zinc-400 mb-4">Plan Comparison</h2>
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
