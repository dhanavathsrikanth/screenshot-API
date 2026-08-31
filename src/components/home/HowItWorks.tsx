const steps = [
  {
    number: "01",
    title: "Create your account",
    command: "signup()",
    description:
      "Sign up in seconds and grab your API key from the dashboard. Your free plan includes 100 renders every month — no credit card needed.",
  },
  {
    number: "02",
    title: "Call the API",
    command: "GET /api/take",
    description:
      "Send a single GET request with your URL. Free covers viewport PNG, JPEG, and WebP. Starter ($9) adds full-page, PDF, and higher volume.",
  },
  {
    number: "03",
    title: "Get clean screenshots",
    command: "response: blob",
    description:
      "Receive a viewport image in seconds. Ads, cookie banners, and chat widgets are stripped automatically. Upgrade to Starter when you need the full scrollable page or PDF.",
  },
];

export function HowItWorks() {
  return (
    <section className="mb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          how it works
        </h2>
        <div className="grid grid-cols-1 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.number} className="bg-white p-[22px] dark:bg-[var(--card)]">
              <span className="mb-1.5 block font-mono text-[11px] text-[var(--accent)]">
                {step.command}
              </span>
              <span className="mb-2.5 block text-[13px] font-semibold">
                {step.title}
              </span>
              <p className="text-[13px] leading-[1.55] text-[var(--dim)]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
