import Link from "next/link";

export function CTASection() {
  return (
    <section className="mb-16 px-6">
      <div className="mx-auto max-w-3xl rounded-lg border border-[var(--line)] bg-white p-8 text-center dark:bg-[var(--card)]">
        <h2 className="text-balance text-xl font-semibold tracking-[-0.02em]">
          Ready to render your first screenshot?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[13px] leading-[1.6] text-[var(--dim)]">
          Join thousands of developers using ScreenshotAPI. 100 free renders every month — no credit card
          required, and you&apos;ll land straight in your dashboard.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-6 py-2.5 text-sm font-medium text-[var(--background)] transition-colors active:scale-[0.96]"
          >
            Get Started Free
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-6 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--muted)]"
          >
            Documentation
          </Link>
        </div>
        <p className="mt-5 text-[11px] text-[var(--dim)]">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[var(--ink)]">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--ink)]">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
