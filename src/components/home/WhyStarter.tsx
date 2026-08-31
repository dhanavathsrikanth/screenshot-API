import Link from "next/link";
import { competitorSnapshot, positioning } from "@/lib/marketing";

export function WhyStarter() {
  return (
    <section className="mb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          why teams pay $9
        </h2>
        <p className="mb-6 max-w-2xl text-[13px] leading-[1.55] text-[var(--dim)]">
          Free is for evaluating the API. Most products upgrade when screenshots become a shipped feature —
          full-page, PDF, volume, and history that outlasts a day.
        </p>

        <div className="overflow-x-auto rounded-lg border border-[var(--line)]">
          <table className="w-full min-w-[520px] text-left">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--muted)]/40">
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
                  Service
                </th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
                  Entry paid
                </th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
                  Monthly volume
                </th>
                <th className="px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-[var(--dim)]">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {competitorSnapshot.map((row, i) => (
                <tr
                  key={row.name}
                  className={`border-b border-[var(--line)] last:border-0 ${
                    i === 0 ? "bg-orange-50/60 dark:bg-orange-950/20" : "bg-white dark:bg-[var(--card)]"
                  }`}
                >
                  <td className="px-4 py-3 text-[13px] font-semibold">{row.name}</td>
                  <td className="px-4 py-3 text-[13px] text-[var(--dim)]">{row.price}</td>
                  <td className="px-4 py-3 text-[13px] text-[var(--dim)]">{row.volume}</td>
                  <td className="px-4 py-3 text-[13px] text-[var(--dim)]">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-[11px] text-[var(--dim)]">
          Competitor pricing checked periodically — see their sites for current rates.{" "}
          <Link href="/docs/migrate/screenshotone" className="underline hover:text-[var(--ink)]">
            Migrate from ScreenshotOne
          </Link>
          {" · "}
          <Link href="/docs/migrate/urlbox" className="underline hover:text-[var(--ink)]">
            Urlbox
          </Link>
          {" · "}
          <Link href="/docs/clean-captures" className="underline hover:text-[var(--ink)]">
            Clean-capture URL set
          </Link>
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-2.5 text-sm font-medium text-[var(--background)] transition-colors"
          >
            Start free — upgrade when you ship
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] px-5 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--muted)]"
          >
            {positioning.starterOffer}
          </Link>
        </div>
      </div>
    </section>
  );
}
