import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/docs/code-block";
import { siteConfig } from "@/lib/site";
import { getMigration, migrationGuides } from "@/lib/migrations";

export function generateStaticParams() {
  return migrationGuides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getMigration(slug);
  if (!guide) return {};
  return {
    title: `${guide.title} - ScreenshotAPI`,
    description: guide.description,
    alternates: { canonical: `/docs/migrate/${guide.slug}` },
  };
}

export default async function MigratePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getMigration(slug);
  if (!guide) notFound();

  const curl = `curl "${siteConfig.apiUrl}/api/take?url=https://example.com&format=png&full_page=true" \\\n  -H "Authorization: Bearer sk_live_YOUR_KEY" \\\n  --output screenshot.png`;

  const siblings = migrationGuides.filter((g) => g.slug !== guide.slug);

  return (
    <div className="pt-16">
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6">
        <nav className="mb-8 text-sm text-[var(--dim)]">
          <Link href="/docs" className="hover:text-[var(--ink)]">Docs</Link>
          <span aria-hidden="true"> / </span>
          <span>Migrate from {guide.competitor}</span>
        </nav>

        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">Migration</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{guide.title}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--dim)]">{guide.description}</p>

        <h2 className="mt-10 text-lg font-semibold">1. Replace the host</h2>
        <p className="mt-2 text-sm text-[var(--dim)]">
          Typical {guide.competitor} endpoint:{" "}
          <code className="font-mono text-xs">{guide.fromHost}</code>
        </p>
        <div className="mt-4">
          <CodeBlock label="bash" code={curl} />
        </div>

        <h2 className="mt-10 text-lg font-semibold">2. Map parameters</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                <th className="px-4 py-3 font-medium">{guide.competitor}</th>
                <th className="px-4 py-3 font-medium">ScreenshotAPI</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {guide.params.map((row) => (
                <tr key={row.them} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{row.them}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.us}</td>
                  <td className="px-4 py-3 text-[13px] text-[var(--dim)]">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-lg font-semibold">3. Defaults that differ</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--dim)]">
          {guide.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-[var(--dim)]">
          Need a clean-capture check on hard sites? See the{" "}
          <Link href="/docs/clean-captures" className="text-orange-600 hover:underline">
            overlay challenge set
          </Link>
          . Full parameter list:{" "}
          <Link href="/docs#parameters" className="text-orange-600 hover:underline">
            API reference
          </Link>
          .
        </p>

        {siblings.length > 0 && (
          <p className="mt-6 text-sm text-[var(--dim)]">
            Also migrating from{" "}
            {siblings.map((s) => (
              <Link key={s.slug} href={`/docs/migrate/${s.slug}`} className="text-orange-600 hover:underline">
                {s.competitor}
              </Link>
            ))}
            ?
          </p>
        )}
      </article>
    </div>
  );
}
