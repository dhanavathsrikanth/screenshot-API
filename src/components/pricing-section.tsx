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
      adBlocking: true,
      cookieBlocking: true,
      trackerBlocking: true,
      fullPage: false,
      customViewport: true,
      waitForSelector: true,
      pdfExport: false,
      cloudStorage: false,
      elementCapture: true,
      apiKeys: "1",
      rateLimit: "10 req/min",
      support: "Community",
      sla: null,
      geoTargeting: false,
      videoCapture: false,
    },
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 9,
    description: "For developers building integrations",
    cta: "Get Started",
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
      trackerBlocking: true,
      fullPage: true,
      customViewport: true,
      waitForSelector: true,
      pdfExport: true,
      cloudStorage: false,
      elementCapture: true,
      apiKeys: "5",
      rateLimit: "40 req/min",
      support: "Email",
      sla: "99.9% uptime",
      geoTargeting: false,
      videoCapture: false,
    },
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 49,
    description: "For teams shipping production features",
    cta: "Get Started",
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
      trackerBlocking: true,
      fullPage: true,
      customViewport: true,
      waitForSelector: true,
      pdfExport: true,
      cloudStorage: true,
      elementCapture: true,
      geoTargeting: true,
      videoCapture: false,
      apiKeys: "25",
      rateLimit: "120 req/min",
      support: "Priority email",
      sla: "99.9% uptime",
    },
  },
  {
    id: "scale",
    name: "Scale",
    monthlyPrice: 79,
    description: "For products that need premium capture capabilities",
    cta: "Get Started",
    href: "/sign-up",
    popular: false,
    overage: "$0.002 / extra",
    features: {
      screenshots: "50,000 / month",
      formats: "PNG, JPEG, WebP, PDF, MP4, GIF",
      rendering: "Highest priority",
      caching: "CDN caching",
      storage: "180 days",
      adBlocking: true,
      cookieBlocking: true,
      trackerBlocking: true,
      fullPage: true,
      customViewport: true,
      waitForSelector: true,
      pdfExport: true,
      cloudStorage: true,
      elementCapture: true,
      geoTargeting: true,
      videoCapture: true,
      apiKeys: "50",
      rateLimit: "240 req/min",
      support: "Priority email",
      sla: "99.9% uptime",
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
      { key: "trackerBlocking", label: "Tracker blocking", check: true },
      { key: "elementCapture", label: "Element capture (CSS selector)", check: true },
      { key: "geoTargeting", label: "Geo-targeted rendering (country)", check: true },
      { key: "videoCapture", label: "Video / GIF capture", check: true },
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
  if (value === null) return <span className="text-[var(--line)]">&mdash;</span>;
  if (typeof value === "boolean") {
    return value ? (
      <svg className="h-4 w-4 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ) : (
      <svg className="h-4 w-4 text-[var(--line)] mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return <span className="text-[13px]">{value}</span>;
}

export function PricingSection() {
  return (
    <section className="mb-16 px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          pricing
        </h2>
        <p className="mb-8 text-[13px] leading-[1.55] text-[var(--dim)]">
          Start free, scale as you grow. No hidden fees. Only pay for what you use.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const price = plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                className={`rounded-lg border p-5 flex flex-col relative transition-colors ${
                  plan.popular
                    ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                    : "border-[var(--line)] hover:border-[var(--dim)]"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-medium text-white">
                    Most Popular
                  </span>
                )}

                <div>
                  <h3 className="text-base font-semibold">{plan.name}</h3>
                  <p className="text-[13px] text-[var(--dim)] mt-0.5">{plan.description}</p>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  {plan.monthlyPrice === 0 ? (
                    <span className="text-3xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">${price}</span>
                      <span className="text-[13px] text-[var(--dim)]">/mo</span>
                    </>
                  )}
                </div>

                {plan.overage && (
                  <p className="text-[12px] text-[var(--dim)] mt-1">Overage: {plan.overage}</p>
                )}

                <Link
                  href={plan.href}
                  className={`mt-5 block w-full rounded px-4 py-2 text-center text-[13px] font-medium transition-colors ${
                    plan.popular
                      ? "bg-[var(--ink)] text-[var(--background)]"
                      : "border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--muted)]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-16">
          <h2 className="mb-6 text-center text-base font-semibold">Compare all features</h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="text-left py-2.5 pr-4 text-[12px] font-medium text-[var(--dim)] w-1/3"></th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="text-center py-2.5 px-3 text-[12px] font-medium">
                      <span className={plan.popular ? "text-[var(--accent)]" : ""}>{plan.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureGroups.map((group) => (
                  <Fragment key={group.name}>
                    <tr>
                      <td colSpan={5} className="pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--dim)]">
                        {group.name}
                      </td>
                    </tr>
                    {group.features.map((feature) => (
                      <tr key={feature.key} className="border-b border-[var(--line)]/50">
                        <td className="py-2.5 pr-4 text-[13px] text-[var(--dim)]">{feature.label}</td>
                        {plans.map((plan) => (
                          <td key={plan.id} className="py-2.5 px-3 text-center text-[13px]">
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
        <div className="mt-16">
          <h2 className="mb-6 text-center text-base font-semibold">Frequently asked questions</h2>
          <div className="space-y-3">
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
                q: "Do you offer annual billing?",
                a: "Not yet. All plans are billed monthly, and you can upgrade or downgrade at any time.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We accept all major credit cards (Visa, Mastercard, Amex).",
              },
            ].map((faq) => (
              <div key={faq.q} className="rounded-lg border border-[var(--line)] bg-white p-4 dark:bg-[var(--card)]">
                <h3 className="text-[13px] font-semibold">{faq.q}</h3>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--dim)]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-16 rounded-lg bg-[var(--ink)] p-8 text-center">
          <h2 className="text-lg font-semibold text-[var(--background)]">Need more than 50,000 screenshots?</h2>
          <p className="mt-2 text-[13px] text-[var(--dim)] max-w-lg mx-auto">
            Custom plans with dedicated infrastructure, custom SLAs, volume discounts, and a dedicated account manager.
          </p>
          <Link
            href="mailto:enterprise@screenshotapi.tech"
            className="mt-5 inline-flex items-center gap-2 rounded bg-[var(--background)] px-5 py-2.5 text-[13px] font-medium text-[var(--ink)] transition-colors hover:opacity-90"
          >
            Contact Sales
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
