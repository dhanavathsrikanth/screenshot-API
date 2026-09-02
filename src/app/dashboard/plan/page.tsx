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
import { UsageAlerts, UpgradePrompt } from "@/components/dashboard/charts";
import { UpgradeSuccessBanner } from "@/components/upgrade-success-banner";
import { BuyCredits } from "@/components/dashboard/buy-credits";
import { OverageToggle } from "@/components/dashboard/overage-toggle";
import { CustomerPortalButton } from "@/components/dashboard/customer-portal-button";
import { getPlanLabel, getPlanBadgeClass } from "@/lib/plan-display";

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
      page_size: 8,
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

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

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

  let stats: {
    plan: string;
    monthlyUsed: number;
    monthlyLimit: number;
    creditBalance: number;
    creditsUsedThisCycle: number;
    creditsGrantedThisCycle: number;
    topUpBalance: number;
    overageEnabled: boolean;
  };
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
    stats = {
      plan: "free",
      monthlyUsed: 0,
      monthlyLimit: 100,
      creditBalance: 0,
      creditsUsedThisCycle: 0,
      creditsGrantedThisCycle: 0,
      topUpBalance: 0,
      overageEnabled: false,
    };
    costEst = {
      plan: "free",
      monthlyPrice: 0,
      monthlyUsed: 0,
      monthlyLimit: 100,
      computeCost: 0,
      storageCost: 0,
      totalEstimatedCost: 0,
      storageGB: 0,
      costPerScreenshot: 0,
      recommendedPlan: null,
    };
    alerts = [];
    allPlanLimits = getAllPlanLimits();
  }

  try {
    const supabase = await createClient();
    const { data: userRow } = await supabase.from("users").select("dodo_customer_id").eq("id", userId).maybeSingle();
    customerId = userRow?.dodo_customer_id ?? null;
    payments = await fetchRecentPayments(customerId);
  } catch {}

  void acknowledgeAlert;

  const currentPlan = stats.plan as PlanId;
  const planIds: PlanId[] = ["free", "starter", "pro", "scale"];
  const usagePct = stats.monthlyLimit > 0 ? Math.min((stats.monthlyUsed / stats.monthlyLimit) * 100, 100) : 0;

  const comparisonRows: { label: string; key: string; format: (limits: PlanLimits) => string | number | boolean }[] = [
    { label: "Screenshots", key: "monthlyScreenshots", format: (l) => l.monthlyScreenshots.toLocaleString() },
    { label: "Rate limit", key: "rateLimitPerMinute", format: (l) => `${l.rateLimitPerMinute}/min` },
    { label: "API keys", key: "apiKeys", format: (l) => l.apiKeys },
    { label: "Formats", key: "formats", format: (l) => l.formats.join(", ").toUpperCase() },
    { label: "Full page", key: "fullPage", format: (l) => l.fullPage },
    { label: "PDF", key: "pdfExport", format: (l) => l.pdfExport },
    { label: "Geo targeting", key: "geoTargeting", format: (l) => l.geoTargeting },
    { label: "Video / GIF", key: "videoCapture", format: (l) => l.videoCapture },
  ];

  const planLimitsMap: Record<PlanId, PlanLimits> = {} as Record<PlanId, PlanLimits>;
  for (const p of allPlanLimits) planLimitsMap[p.id] = p.limits;

  return (
    <div className="flex flex-col gap-6">
      {/* Header — minimal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--ink)]">Billing</h1>
          <p className="mt-1 text-sm text-[var(--dim)]">
            Plan, credits and invoices &middot;{" "}
            <a href="/docs" className="underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--ink)]">
              Docs
            </a>
            <span className="mx-1.5 text-[var(--border)]">·</span>
            <a href="/docs#pricing" className="underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--ink)]">
              Pricing
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/docs"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium hover:bg-[var(--muted)] transition-colors"
          >
            Docs
            <svg className="h-3.5 w-3.5 opacity-50" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H21v6m-3-9L3 18l9-9" />
            </svg>
          </a>
          <CustomerPortalButton hasCustomer={Boolean(customerId)} />
        </div>
      </div>

      <Suspense>
        <UpgradeSuccessBanner />
      </Suspense>

      {/* Current plan — single hero card */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ink)] text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getPlanBadgeClass(currentPlan)}`}>
                  {getPlanLabel(currentPlan)}
                </span>
                <span className="text-xs text-[var(--dim)]">{stats.monthlyLimit.toLocaleString()} / month</span>
              </div>
              <p className="mt-1 text-sm font-medium text-[var(--ink)]">
                {stats.monthlyUsed.toLocaleString()} used
                <span className="font-normal text-[var(--dim)]"> · {stats.creditBalance.toLocaleString()} credits left</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:block h-10 w-px bg-[var(--border)]" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-[var(--dim)]">Usage</p>
                <p className="text-sm font-semibold tabular-nums">{Math.round(usagePct)}%</p>
              </div>
              <div className="relative h-12 w-12">
                <svg className="h-12 w-12 -rotate-90" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="16" fill="none" stroke="var(--muted)" strokeWidth="4" />
                  <circle
                    cx="22"
                    cy="22"
                    r="16"
                    fill="none"
                    stroke={usagePct >= 90 ? "#ef4444" : usagePct >= 75 ? "#f59e0b" : "var(--accent)"}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(usagePct / 100) * 100.53} 100.53`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
                  {stats.monthlyUsed}
                </span>
              </div>
            </div>
            <div className="hidden sm:block text-right">
              <p className="text-xs text-[var(--dim)]">Credits</p>
              <p className="text-sm font-semibold tabular-nums">{stats.creditBalance.toLocaleString()}</p>
              <p className="text-[11px] text-[var(--dim)]">
                {stats.topUpBalance > 0 ? `+${stats.topUpBalance.toLocaleString()} top-up` : stats.plan === "free" ? "lifetime" : "this cycle"}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--muted)]/40 px-5 py-3 sm:px-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 sm:mr-6">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${usagePct}%`,
                  background: usagePct >= 90 ? "#ef4444" : usagePct >= 75 ? "#f59e0b" : "var(--accent)",
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-[var(--dim)] tabular-nums">
              <span>0</span>
              <span>{stats.monthlyLimit.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <a href="/docs#rate-limits" className="text-[var(--dim)] hover:text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4">
              Limits
            </a>
            <span className="text-[var(--border)]">·</span>
            <a href="/docs#pricing" className="text-[var(--dim)] hover:text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4">
              Pricing
            </a>
          </div>
        </div>
      </div>

      {/* Alerts + upgrade — only when relevant */}
      <UsageAlerts data={alerts} />
      <UpgradePrompt data={{ plan: stats.plan, monthlyUsed: stats.monthlyUsed, monthlyLimit: stats.monthlyLimit, recommendedPlan: costEst.recommendedPlan }} />

      {/* Overage + Credits — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OverageToggle enabled={stats.overageEnabled} plan={stats.plan} />
        <div className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Need more?</h3>
              <p className="mt-1 text-xs text-[var(--dim)]">
                Top-up credits or change plan. <a href="/docs#pricing" className="underline hover:text-[var(--ink)]">Details in docs</a>
              </p>
            </div>
            {customerId && (
              <a href="/customer-portal" className="shrink-0 text-xs font-medium text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--ink)]">
                Portal →
              </a>
            )}
          </div>
          <div className="mt-4">
            <BuyCredits compact />
          </div>
        </div>
      </div>

      {/* Billing history — compact */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">Invoices</h3>
          <div className="flex items-center gap-2">
            {customerId ? (
              <a href="/customer-portal" className="text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)]">
                Manage in portal →
              </a>
            ) : (
              <span className="text-xs text-[var(--dim)]">No billing profile yet</span>
            )}
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-5 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--dim)]">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="text-sm font-medium">No invoices yet</p>
            <p className="text-xs text-[var(--dim)] max-w-[28ch]">
              Invoices appear here after your first payment. <a href="/docs#pricing" className="underline hover:text-[var(--ink)]">How billing works</a>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30 text-[11px] uppercase tracking-wide text-[var(--dim)]">
                  <th className="text-left font-medium py-2.5 px-5">Date</th>
                  <th className="text-left font-medium py-2.5 px-4">Amount</th>
                  <th className="text-left font-medium py-2.5 px-4">Status</th>
                  <th className="text-right font-medium py-2.5 px-5">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.payment_id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]/30 transition-colors">
                    <td className="py-3 px-5 tabular-nums text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium tabular-nums text-xs">{formatAmount(p.total_amount, p.currency)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex rounded-full bg-green-50 dark:bg-green-900/20 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-300 capitalize">
                        {p.status ?? "succeeded"}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right">
                      {p.invoice_url ? (
                        <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ink)] hover:underline">
                          Download
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H12a.75.75 0 0 0-.75.75v5.59l-.72-.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l2-2a.75.75 0 1 0-1.06-1.06l-.72.72V6.75A.75.75 0 0 0 13.5 6Z" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--dim)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 px-5 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-[var(--dim)]">
            Powered by <span className="font-medium text-[var(--ink)]">Dodo Payments</span> · Secure checkout
          </span>
          <a href="/docs#pricing" className="text-[11px] font-medium text-[var(--dim)] hover:text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4">
            Billing FAQ →
          </a>
        </div>
      </div>

      {/* Plan comparison — minimal */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold">Compare plans</h3>
          <a href="/docs#pricing" className="text-xs text-[var(--dim)] hover:text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4">
            Full details →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                <th className="text-left py-3 px-5 text-xs font-medium text-[var(--dim)]">Feature</th>
                {planIds.map((pid) => (
                  <th
                    key={pid}
                    className={`text-center py-3 px-3 text-xs font-semibold whitespace-nowrap ${pid === currentPlan ? "text-[var(--ink)] bg-orange-50 dark:bg-orange-950/20" : "text-[var(--dim)]"}`}
                  >
                    {getPlanLabel(pid)}
                    {pid === currentPlan && <span className="ml-1.5 inline-flex rounded-full bg-orange-600 px-1.5 py-0.5 text-[9px] font-bold text-white align-middle">CURRENT</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5 px-5 text-xs text-[var(--dim)] whitespace-nowrap">{row.label}</td>
                  {planIds.map((pid) => {
                    const val = row.format(planLimitsMap[pid]);
                    const isCurrent = pid === currentPlan;
                    return (
                      <td key={pid} className={`text-center py-2.5 px-3 text-xs ${isCurrent ? "bg-orange-50/50 dark:bg-orange-950/10 font-medium" : ""}`}>
                        {typeof val === "boolean" ? (
                          val ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </span>
                          ) : (
                            <span className="text-[var(--border)]">—</span>
                          )
                        ) : (
                          <span className="tabular-nums">{String(val)}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 flex items-center justify-between bg-[var(--muted)]/30 border-t border-[var(--border)]">
          <span className="text-[11px] text-[var(--dim)]">Need help choosing? <a href="/docs" className="underline hover:text-[var(--ink)]">Read the docs</a></span>
          <a href="/docs#pricing" className="text-[11px] font-medium text-orange-600 hover:text-orange-700 dark:text-orange-400">See pricing →</a>
        </div>
      </div>
    </div>
  );
}
