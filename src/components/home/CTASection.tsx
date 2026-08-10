export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl text-white">
          Ready to render your first screenshot?
        </h2>
        <p className="mt-4 text-lg text-indigo-100">
          Join thousands of developers using ScreenshotAPI. 100 free renders/month, no credit card required.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://screenshotapi.tech/take?url=https://example.com"
            className="rounded-lg bg-white px-8 py-4 text-base font-semibold text-indigo-600 shadow-lg hover:bg-indigo-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600"
          >
            Get Started Free
          </a>
          <a
            href="/docs"
            className="rounded-lg border-2 border-white/30 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600"
          >
            View Documentation
          </a>
        </div>
        <p className="mt-6 text-sm text-indigo-200">
          By continuing, you agree to our{" "}
          <a href="#" className="underline hover:text-white">Terms of Service</a>{" "}
          and{" "}
          <a href="#" className="underline hover:text-white">Privacy Policy</a>
          .
        </p>
      </div>
    </section>
  );
}