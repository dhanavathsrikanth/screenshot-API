import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For individuals and small projects",
    features: [
      "100 screenshots/month",
      "All rendering options",
      "PNG, JPEG, WebP, PDF",
      "Edge caching",
      "Community support",
    ],
    cta: "Get Started",
    href: "/dashboard",
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    description: "For developers and small teams",
    features: [
      "10,000 screenshots/month",
      "Priority rendering",
      "S3/R2 storage integration",
      "Cookie banner blocking",
      "Ad blocking",
      "API access",
      "Email support",
    ],
    cta: "Start Free Trial",
    href: "/dashboard",
    popular: true,
  },
  {
    name: "Business",
    price: "$49",
    period: "/month",
    description: "For growing businesses",
    features: [
      "100,000 screenshots/month",
      "Faster rendering pool",
      "Custom integrations",
      "Proxy support",
      "Team members",
      "SLA guarantee",
      "Priority support",
    ],
    cta: "Contact Sales",
    href: "/dashboard",
  },
];

export function PricingSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold">Simple, transparent pricing</h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Start for free. Scale when you grow.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-8 ${
                plan.popular
                  ? "border-indigo-500 ring-1 ring-indigo-500 relative"
                  : "border-[var(--border)]"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{plan.description}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-sm text-zinc-500">{plan.period}</span>
                )}
              </div>
              <ul className="mt-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="text-indigo-500">&#10003;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block w-full rounded-lg px-4 py-3 text-center text-sm font-medium transition-colors ${
                  plan.popular
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "border border-[var(--border)] hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
