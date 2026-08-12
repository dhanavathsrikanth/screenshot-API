"use client";

import Link from "next/link";
import { Fragment } from "react";

const plans = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    description: "For individuals and side projects",
    cta: "Get Started",
    href: "/sign-up",
    popular: false,
    overage: null,
    features: {
      screenshots: "100 / month",
      formats: "PNG, JPEG, WebP",
      rendering: "Standard",
      caching: "CDN caching",
      storage: "24h temporary",
      adBlocking: false,
      cookieBlocking: false,
      fullPage: true,
      customViewport: true,
      waitForSelector: true,
      pdfExport: false,
      cloudStorage: false,
      apiKeys: "1",
      rateLimit: "10 req/min",
      support: "Community",
      sla: null,
    },
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 9,
    description: "For developers building integrations",
    cta: "Start Free Trial",
    href: "/sign-up",
    popular: false,
    overage: "$0.005 / extra",
    features: {
      screenshots: "2,500 / month",
      formats: "PNG, JPEG, WebP, PDF",
      rendering: "Priority",
      caching: "CDN caching",
      storage: "30 days",
      adBlocking: true,
      cookieBlocking: true,
      fullPage: true,
      customViewport: true,
      waitForSelector: true,
      pdfExport: true,
      cloudStorage: false,
      apiKeys: "5",
      rateLimit: "40 req/min",
      support: "Email",
      sla: null,
    },
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 49,
    description: "For teams shipping production features",
    cta: "Start Free Trial",
    href: "/sign-up",
    popular: true,
    overage: "$0.003 / extra",
    features: {
      screenshots: "15,000 / month",
      formats: "PNG, JPEG, WebP, PDF",
      rendering: "High priority",
      caching: "CDN caching",
      storage: "90 days",
      adBlocking: true,
      cookieBlocking: true,
      fullPage: true,
      customViewport: true,
      waitForSelector: true,
      pdfExport: true,
      cloudStorage: true,
      apiKeys: "25",
      rateLimit: "120 req/min",
      support: "Priority email",
      sla: "99.9% uptime",
    },
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 149,
    description: "For growing companies with high volume",
    cta: "Start Free Trial",
    href: "/sign-up",
    popular: false,
    overage: "$0.002 / extra",
    features: {
      screenshots: "50,000 / month",
      formats: "PNG, JPEG, WebP, PDF",
      rendering: "Dedicated pool",
      caching: "CDN caching",
      storage: "1 year",
      adBlocking: true,
      cookieBlocking: true,
      fullPage: true,
      customViewport: true,
      waitForSelector: true,
      pdfExport: true,
      cloudStorage: true,
      apiKeys: "100",
      rateLimit: "500 req/min",
      support: "Phone + Slack",
      sla: "99.95% uptime",
    },
  },
];

const featureGroups = [
  {
    name: "Rendering",
    features: [
      { key: "screenshots", label: "Monthly screenshots" },
      { key: "formats", label: "Output formats" },
      { key: "rendering", label: "Rendering priority" },
      { key: "fullPage", label: "Full-page screenshots", check: true },
      { key: "customViewport", label: "Custom viewport sizes", check: true },
      { key: "waitForSelector", label: "Wait for selector / network idle", check: true },
    ],
  },
  {
    name: "Output & Storage",
    features: [
      { key: "pdfExport", label: "PDF export", check: true },
      { key: "cloudStorage", label: "Cloud storage (S3/R2)", check: true },
      { key: "caching", label: "CDN caching" },
      { key: "storage", label: "Screenshot retention" },
    ],
  },
  {
    name: "Features",
    features: [
      { key: "adBlocking", label: "Ad & banner blocking", check: true },
      { key: "cookieBlocking", label: "Cookie consent blocking", check: true },
    ],
  },
  {
    name: "Limits & Access",
    features: [
      { key: "apiKeys", label: "API keys" },
      { key: "rateLimit", label: "Rate limit" },
    ],
  },
  {
    name: "Support & SLA",
    features: [
      { key: "support", label: "Support" },
      { key: "sla", label: "SLA guarantee" },
    ],
  },
];

function FeatureValue({ value }: { value: string | boolean | null }) {
  if (value === null) return <span className="text-zinc-300 dark:text-zinc-600">—</span>;
  if (typeof value === "boolean") {
    return value ? (
      <svg className="h-5 w-5 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ) : (
      <svg className="h-5 w-5 text-zinc-300 dark:text-zinc-600 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return <span className="text-sm">{value}</span>;
}

export function PricingSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Start free, scale as you grow. No hidden fees. Only pay for what you use.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => {
            const price = plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col relative ${
                  plan.popular
                    ? "border-indigo-500 ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10"
                    : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                } transition-colors`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                    Most Popular
                  </span>
                )}

                <div>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{plan.description}</p>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  {plan.monthlyPrice === 0 ? (
                    <span className="text-4xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-4xl font-bold">${price}</span>
                      <span className="text-sm text-zinc-500">/mo</span>
                    </>
                  )}
                </div>

                {plan.overage && (
                  <p className="text-xs text-zinc-400 mt-1">Overage: {plan.overage}</p>
                )}

                <Link
                  href={plan.href}
                  className={`mt-6 block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                    plan.popular
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-24 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Compare all features</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left py-3 pr-4 text-sm font-medium text-zinc-500 w-1/3"></th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="text-center py-3 px-3 text-sm font-medium">
                      <span className={plan.popular ? "text-indigo-600 dark:text-indigo-400" : ""}>{plan.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureGroups.map((group) => (
                  <Fragment key={group.name}>
                    <tr>
                      <td colSpan={5} className="pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        {group.name}
                      </td>
                    </tr>
                    {group.features.map((feature) => (
                      <tr key={feature.key} className="border-b border-zinc-100 dark:border-zinc-800/50">
                        <td className="py-3 pr-4 text-sm text-zinc-600 dark:text-zinc-400">{feature.label}</td>
                        {plans.map((plan) => (
                          <td key={plan.id} className="py-3 px-3 text-center text-sm">
                            <FeatureValue value={(plan.features as Record<string, string | boolean | null>)[feature.key]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-6">
            {[
              {
                q: "Do cached screenshots count toward my limit?",
                a: "No. Screenshots served from our CDN cache do not count toward your monthly quota. Only fresh renders are billed.",
              },
              {
                q: "What happens when I exceed my plan limit?",
                a: "You can enable overage billing in your dashboard. Extra screenshots are billed at the overage rate for your plan. You'll receive alerts at 80% and 100% of your limit.",
              },
              {
                q: "Can I change plans at any time?",
                a: "Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the start of your next billing cycle.",
              },
              {
                q: "Is there a free trial for paid plans?",
                a: "Yes. All paid plans include a 7-day free trial with full access to your chosen plan's features. No credit card required.",
              },
              {
                q: "Do you offer annual billing?",
                a: "Not yet. All plans are billed monthly, and you can upgrade or downgrade at any time.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards (Visa, Mastercard, Amex) and offer wire transfer for Business and Enterprise plans.",
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <h3 className="text-sm font-semibold">{faq.q}</h3>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-20 rounded-2xl bg-zinc-900 dark:bg-zinc-100 p-8 md:p-12 text-center max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white dark:text-zinc-900">Need more than 50,000 screenshots?</h2>
          <p className="mt-3 text-zinc-400 dark:text-zinc-500 max-w-xl mx-auto">
            Custom plans with dedicated infrastructure, custom SLAs, volume discounts, and a dedicated account manager.
          </p>
          <Link
            href="mailto:enterprise@screenshotapi.tech"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white dark:bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Contact Sales
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
