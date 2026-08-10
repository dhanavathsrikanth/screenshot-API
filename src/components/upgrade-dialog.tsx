"use client";

import { useState } from "react";

const paidPlans = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 9,
    description: "For developers building integrations",
    screenshots: "2,500",
    overage: "$0.005 / extra",
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER_ID || "",
    color: "blue",
    features: ["2,500 screenshots/mo", "PNG, JPEG, WebP, PDF", "Ad & cookie blocking", "5 API keys", "40 req/min", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 49,
    description: "For teams shipping production features",
    screenshots: "15,000",
    overage: "$0.003 / extra",
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO_ID || "",
    popular: true,
    color: "indigo",
    features: ["15,000 screenshots/mo", "PNG, JPEG, WebP, PDF", "Cloud storage (R2)", "25 API keys", "120 req/min", "Priority support + 99.9% SLA"],
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 149,
    description: "For growing companies with high volume",
    screenshots: "50,000",
    overage: "$0.002 / extra",
    productId: process.env.NEXT_PUBLIC_DODO_PRODUCT_BUSINESS_ID || "",
    color: "purple",
    features: ["50,000 screenshots/mo", "PNG, JPEG, WebP, PDF", "Cloud storage (R2)", "100 API keys", "500 req/min", "Phone + Slack support + 99.95% SLA"],
  },
];

export function UpgradeDialog({
  open,
  onClose,
  currentPlan,
}: {
  open: boolean;
  onClose: () => void;
  currentPlan?: string;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(productId: string, planId: string) {
    if (!productId) {
      setError("Checkout is not configured yet. Product ID is missing.");
      return;
    }
    setLoading(planId);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          quantity: 1,
          return_url: `${window.location.origin}/dashboard/plan?upgraded=1`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start checkout");
        setLoading(null);
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-lg p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
            Upgrade Your Plan
          </div>
          <h2 className="text-2xl font-bold">Choose the right plan for you</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-md mx-auto">
            Unlock more screenshots, faster rendering, and premium features. Cancel anytime.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-8 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            {error}
          </div>
        )}

        {/* Plans */}
        <div className="px-8 pb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {paidPlans.map((plan) => {
            const price = plan.monthlyPrice;
            const isCurrent = currentPlan === plan.id;
            const isLoading = loading === plan.id;
            const colorClasses = {
              blue: {
                border: plan.popular ? "border-indigo-500 ring-2 ring-indigo-500" : isCurrent ? "border-blue-500 ring-2 ring-blue-500/50" : "border-zinc-200 dark:border-zinc-800",
                badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                button: "bg-blue-600 hover:bg-blue-700 text-white",
                check: "text-blue-500",
              },
              indigo: {
                border: "border-indigo-500 ring-2 ring-indigo-500",
                badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
                button: "bg-indigo-600 hover:bg-indigo-700 text-white",
                check: "text-indigo-500",
              },
              purple: {
                border: isCurrent ? "border-purple-500 ring-2 ring-purple-500/50" : "border-zinc-200 dark:border-zinc-800",
                badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                button: "bg-purple-600 hover:bg-purple-700 text-white",
                check: "text-purple-500",
              },
            };
            const colors = colorClasses[plan.color as keyof typeof colorClasses];

            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-5 flex flex-col relative transition-all ${colors.border} ${
                  plan.popular ? "shadow-lg shadow-indigo-500/10" : ""
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white whitespace-nowrap">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {isCurrent && (
                      <span className="rounded-full bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-500">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{plan.description}</p>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">${price}</span>
                  <span className="text-sm text-zinc-500">/mo</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">Overage: {plan.overage}</p>

                <ul className="mt-4 space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <svg className={`h-4 w-4 flex-shrink-0 mt-[-1px] ${colors.check}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(plan.productId, plan.id)}
                  disabled={isLoading || isCurrent}
                  className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isCurrent
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 cursor-default"
                      : colors.button
                  }`}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Redirecting...
                    </span>
                  ) : isCurrent ? (
                    "Current Plan"
                  ) : (
                    <>
                      Upgrade to {plan.name}
                      <svg className="inline h-4 w-4 ml-1 -mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 text-center">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            Powered by Dodo Payments. Secure checkout. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
