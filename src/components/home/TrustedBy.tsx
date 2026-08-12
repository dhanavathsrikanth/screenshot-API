const companies = [
  "Vercel",
  "Stripe",
  "Linear",
  "Notion",
  "Figma",
  "Supabase",
];

export function TrustedBy() {
  return (
    <section className="border-y border-[var(--border)] bg-zinc-50/60 py-12 dark:bg-zinc-950/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
          Trusted by engineering teams shipping screenshot features
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {companies.map((company) => (
            <span
              key={company}
              className="cursor-default text-xl font-bold tracking-tight text-zinc-300 transition-colors hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
            >
              {company}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
