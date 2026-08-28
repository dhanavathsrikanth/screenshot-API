import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide, otherGuides, screenshotGuides } from "@/lib/screenshot-guides";
import { getLanguageExample } from "@/lib/examples";
import { siteConfig } from "@/lib/site";
import { CodeBlock } from "@/components/code-block";

export function generateStaticParams() {
  return screenshotGuides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};

  return {
    title: guide.metaTitle,
    description: guide.metaDescription,
    alternates: { canonical: `/screenshot-api/${guide.slug}` },
    openGraph: {
      title: guide.metaTitle,
      description: guide.metaDescription,
      url: `/screenshot-api/${guide.slug}`,
      type: "website",
    },
  };
}

export default async function ScreenshotGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const siblings = otherGuides(guide.slug);
  const languageExample = getLanguageExample(guide.slug);
  const recipeScenarios = [
    { id: "advanced" as const, label: "Full page + options", description: "Full-page WebP at 2x scale in dark mode — common render options in one request." },
    { id: "bulk" as const, label: "Bulk capture", description: "Screenshot many URLs in a single call with concurrency control." },
    { id: "async" as const, label: "Async job (recommended for production)", description: "Create a v1 job, poll until complete, download the stored screenshot — never block on a slow page again." },
  ].filter((scenario) => Boolean(languageExample?.scenarios[scenario.id]));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: siteConfig.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Screenshot API",
            item: `${siteConfig.url}/docs`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: `${guide.language} Guide`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: guide.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
    ],
  };

  return (
    <div className="pt-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-slate-900 dark:hover:text-white">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/docs" className="hover:text-slate-900 dark:hover:text-white">Screenshot API</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-slate-900 dark:text-white">{guide.language}</li>
          </ol>
        </nav>

        <header className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Developer guide
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {guide.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            {guide.metaDescription}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/api-keys"
              className="inline-flex h-11 items-center rounded-lg bg-indigo-600 px-6 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-500"
            >
              Get a free API key
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-11 items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-6 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 dark:text-slate-200 dark:hover:border-slate-600"
            >
              Read the docs
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Free plan included · No credit card required · Setup in under a minute
          </p>
        </header>

        {guide.intro.map((paragraph, i) => (
          <p key={i} className="mx-auto mt-10 max-w-3xl text-base leading-relaxed text-slate-600 first:mt-14 dark:text-slate-400">
            {paragraph}
          </p>
        ))}

        <div className="mx-auto mt-12 max-w-3xl">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Take a website screenshot in {guide.language}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Grab your API key from the dashboard and replace{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">YOUR_API_KEY</code>.
          </p>
          <div className="mt-5">
            <CodeBlock code={guide.code} label={guide.codeLabel} />
          </div>
        </div>

        {languageExample && recipeScenarios.length > 0 && (
          <div className="mx-auto mt-16 max-w-3xl">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              More {guide.language} recipes
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Complete, runnable patterns for real projects — set{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">
                SCREENSHOT_API_KEY
              </code>{" "}
              in your environment and run them as-is.
            </p>
            {recipeScenarios.map((scenario) => (
              <div key={scenario.id} className="mt-8">
                <h3 className="font-semibold text-slate-900 dark:text-white">{scenario.label}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{scenario.description}</p>
                <div className="mt-3">
                  <CodeBlock code={languageExample.scenarios[scenario.id]} label={guide.language.toLowerCase()} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Why developers choose ScreenshotAPI for {guide.language}
          </h2>
          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            {guide.highlights.map((h) => (
              <div key={h.title} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <dt className="flex items-center gap-2.5 font-semibold text-slate-900 dark:text-white">
                  <svg className="h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  {h.title}
                </dt>
                <dd className="mt-2 pl-8 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{h.desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Frequently asked questions
          </h2>
          <div className="mt-6 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
            {guide.faqs.map((faq) => (
              <div key={faq.q} className="p-6">
                <h3 className="font-semibold text-slate-900 dark:text-white">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Screenshot API in other languages
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2.5">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  href={`/screenshot-api/${sibling.slug}`}
                  className="inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                >
                  {sibling.language}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-20 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-10 text-center dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-slate-900">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ready to capture your first screenshot?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-400">
            Create a free account, copy your API key, and start rendering pages with {guide.language} today.
          </p>
          <Link
            href="/sign-up"
            className="mt-7 inline-flex h-11 items-center rounded-lg bg-indigo-600 px-8 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition-colors hover:bg-indigo-500"
          >
            Start for free
          </Link>
        </div>
      </section>
    </div>
  );
}
