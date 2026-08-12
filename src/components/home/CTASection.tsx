import Link from "next/link";

export function CTASection() {
  return (
    <section className="relative overflow-hidden py-24">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black,transparent)]"
        aria-hidden="true"
      />
      <div
        className="absolute -top-24 right-0 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-24 left-0 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Ready to render your first screenshot?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg text-indigo-100">
          Join thousands of developers using ScreenshotAPI. 100 free renders every month — no credit card
          required, and you&apos;ll land straight in your dashboard.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-indigo-700 shadow-lg shadow-indigo-900/20 transition-transform hover:scale-[1.02] hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 sm:w-auto"
          >
            Get Started Free
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            href="/docs"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600 sm:w-auto"
          >
            View Documentation
          </Link>
        </div>
        <p className="mt-6 text-sm text-indigo-200">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-white">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-white">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
