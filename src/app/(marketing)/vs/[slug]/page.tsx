import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { comparisons, getComparison, otherComparisons } from "@/lib/comparisons";
import { siteConfig } from "@/lib/site";

export function generateStaticParams() {
  return comparisons.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) return {};

  return {
    title: comparison.metaTitle,
    description: comparison.metaDescription,
    alternates: { canonical: `/vs/${comparison.slug}` },
    openGraph: {
      title: comparison.metaTitle,
      description: comparison.metaDescription,
      url: `/vs/${comparison.slug}`,
      type: "website",
    },
  };
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const comparison = getComparison(slug);
  if (!comparison) notFound();

  const siblings = otherComparisons(comparison.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Pricing", item: `${siteConfig.url}/pricing` },
          {
            "@type": "ListItem",
            position: 3,
            name: `${siteConfig.name} vs ${comparison.competitor}`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: comparison.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
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
              <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">Pricing</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-slate-900 dark:text-white">
              vs {comparison.competitor}
            </li>
          </ol>
        </nav>

        <header className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Comparison
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            {siteConfig.name} vs {comparison.competitor}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            An honest look at two approaches to the same job — so you can pick the screenshot API that
            fits your stack.
          </p>
        </header>

        <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            <strong className="font-semibold text-slate-900 dark:text-white">
              What is {comparison.competitor}?
            </strong>{" "}
            {comparison.positioning}{" "}
            <a
              href={`https://${comparison.domain}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Visit {comparison.domain}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>{" "}
            for their current features and pricing.
          </p>
        </div>

        {comparison.intro.map((paragraph, i) => (
          <p key={i} className="mx-auto mt-8 max-w-3xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {paragraph}
          </p>
        ))}

        <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900">
                <th scope="col" className="w-2/5 px-5 py-4 font-semibold text-slate-900 dark:text-white">
                  Factor
                </th>
                <th scope="col" className="px-5 py-4 font-semibold text-indigo-700 dark:text-indigo-300">
                  {siteConfig.name}
                </th>
                <th scope="col" className="px-5 py-4 font-semibold text-slate-900 dark:text-white">
                  {comparison.competitor}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--card)]">
              {comparison.rows.map((row) => (
                <tr key={row.factor}>
                  <th scope="row" className="px-5 py-4 align-top font-medium text-slate-700 dark:text-slate-300">
                    {row.factor}
                  </th>
                  <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-400">{row.us}</td>
                  <td className="px-5 py-4 align-top text-slate-600 dark:text-slate-400">{row.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-[var(--border)] bg-slate-50 px-5 py-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-500">
            Competitor details are summarized at the time of writing and may change — verify on the
            vendor&apos;s site before deciding.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <h2 className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Choose {siteConfig.name} if you…
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <li>Want a permanent free plan — not just a trial — with no credit card.</li>
              <li>Need clean captures out of the box (ads &amp; cookie banners blocked by default).</li>
              <li>Prefer one simple GET request over SDK setup.</li>
              <li>Want modern formats like WebP and AVIF alongside PNG, JPEG, and PDF.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              Choose {comparison.competitor} if you…
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {comparison.bestForThem.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Frequently asked questions
          </h2>
          <div className="mt-6 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--card)]">
            {comparison.faqs.map((faq) => (
              <div key={faq.q} className="p-6">
                <h3 className="font-semibold text-slate-900 dark:text-white">{faq.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            More comparisons
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2.5">
            {siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  href={`/vs/${sibling.slug}`}
                  className="inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                >
                  {siteConfig.name} vs {sibling.competitor}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto mt-16 max-w-3xl rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-10 text-center dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-slate-900">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Try {siteConfig.name} free — decide with real screenshots
          </h2>
          <p className="mx-auto mt-3 max-w-md text-slate-600 dark:text-slate-400">
            Free plan, no credit card, and a live demo right on the homepage. Compare results against{" "}
            {comparison.competitor} in minutes.
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
