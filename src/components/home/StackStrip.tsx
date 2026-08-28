import Link from "next/link";
import { screenshotGuides } from "@/lib/screenshot-guides";

const claims = [
  "No SDK required",
  "9 output formats",
  "Free plan included",
  "Ads & banners blocked by default",
];

export function StackStrip() {
  return (
    <section className="mb-16 border-y border-[var(--line)] py-6 px-6">
      <div className="mx-auto max-w-3xl">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {claims.map((claim) => (
            <li key={claim} className="flex items-center gap-2 text-[13px] text-[var(--dim)]">
              <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {claim}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--dim)] uppercase">
            guides for
          </span>
          {screenshotGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/screenshot-api/${guide.slug}`}
              className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] font-medium text-[var(--dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] dark:bg-[var(--card)]"
            >
              {guide.language}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
