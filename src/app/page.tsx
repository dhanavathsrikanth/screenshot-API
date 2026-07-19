import { Playground } from "@/components/playground";
import { Features } from "@/components/features";
import { PricingSection } from "@/components/pricing-section";
import { FormatsSection } from "@/components/home/FormatsSection";
import { CodeExamples } from "@/components/home/CodeExamples";
import { CTASection } from "@/components/home/CTASection";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Hero />
      <TrustedBy />
      <Playground />
      <FormatsSection />
      <Features />
      <CodeExamples />
      <PricingSection />
      <CTASection />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)] bg-gradient-to-b from-indigo-50/50 via-transparent to-transparent dark:from-indigo-950/20 dark:via-transparent">
      <div className="mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8 lg:py-36">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50/80 dark:bg-indigo-950/30 px-4 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-6">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            <span>New: HTML extraction, PDF generation, 9 output formats</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            The Screenshot API
            <br />
            <span className="gradient-text">for Developers</span>
          </h1>
          <p className="mt-8 text-lg leading-8 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Render website screenshots in one simple API call. Block cookie banners, ads,
            and chat widgets. Full-page, high-resolution, dark mode, PDF generation,
            HTML extraction, and 9 output formats.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://api.screentool.dev/take?url=https://example.com"
              className="rounded-lg bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 hover:shadow-indigo-500/40 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Try It Free
            </a>
            <a
              href="/docs"
              className="rounded-lg border-2 border-[var(--border)] px-8 py-4 text-base font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Read the Docs
            </a>
          </div>
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-zinc-500">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
              No credit card required
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
              100 free renders/month
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
              OpenAPI spec included
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
              SDKs for 6+ languages
            </span>
          </div>
        </div>
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-black/50 to-transparent z-10 pointer-events-none h-32 bottom-0 top-auto" />
          <div className="rounded-xl border border-[var(--border)] overflow-hidden shadow-2xl bg-[var(--background)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-zinc-50 dark:bg-zinc-900">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" aria-hidden="true" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" aria-hidden="true" />
                <div className="w-3 h-3 rounded-full bg-green-500" aria-hidden="true" />
              </div>
              <div className="flex-1 text-center text-xs text-zinc-500 font-mono">
                api.screentool.dev/take?url=https://example.com&format=png
              </div>
            </div>
            <div className="p-4 md:p-8">
              <div className="aspect-video rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustedBy() {
  return (
    <section className="py-12 border-b border-[var(--border)] bg-zinc-50/50 dark:bg-zinc-950/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-zinc-500 uppercase tracking-wider mb-8">
          Trusted by developers at innovative companies
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16 opacity-50 hover:opacity-75 transition-opacity">
          <span className="text-lg font-semibold text-zinc-400">Acme Corp</span>
          <span className="text-lg font-semibold text-zinc-400">Globex</span>
          <span className="text-lg font-semibold text-zinc-400">Wayne Enterprises</span>
          <span className="text-lg font-semibold text-zinc-400">Stark Industries</span>
          <span className="text-lg font-semibold text-zinc-400">Umbrella Corp</span>
        </div>
      </div>
    </section>
  );
}