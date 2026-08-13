const steps = [
  {
    number: "01",
    title: "Create your account",
    description:
      "Sign up in seconds and grab your API key from the dashboard. Your free plan includes 100 renders every month — no credit card needed.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Call the API",
    description:
      "Send a single GET request with your URL. Choose from 9 output formats, full-page capture, dark mode, custom viewports, and more.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m-3.75-9h.008v.008H8.25V12Zm7.5 0h.008v.008h-.008V12Z" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Get clean screenshots",
    description:
      "Receive pixel-perfect images or PDFs in milliseconds. Ads, cookie banners, and chat widgets are stripped automatically.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="border-b border-[var(--border)] bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            From URL to screenshot in three steps
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            No infrastructure, no browser setup, no maintenance. Just an API endpoint.
          </p>
        </div>

        <div className="relative mt-14 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          <div
            className="absolute left-[12%] right-[12%] top-9 hidden border-t border-dashed border-slate-300 md:block dark:border-slate-700"
            aria-hidden="true"
          />
          {steps.map((step) => (
            <div key={step.number} className="relative text-center md:text-left">
              <div className="relative mx-auto flex h-18 w-18 items-center justify-center md:mx-0">
                <div className="flex h-18 w-18 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
                  {step.icon}
                </div>
                <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                  {step.number}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-slate-900 dark:text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
