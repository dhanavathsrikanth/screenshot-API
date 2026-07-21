export function TrustedBy() {
  const companies = ["Vercel", "Stripe", "Linear", "Notion", "Figma", "Slack"];
  
  return (
    <section className="py-10 border-b border-[var(--border)] bg-zinc-50/50 dark:bg-zinc-950/50">
      <div className="mx-auto max-w-7xl px-4">
        <p className="text-center text-sm font-medium text-zinc-500 uppercase tracking-wider mb-6">
          Trusted by developers at top companies
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12">
          {companies.map((company) => (
            <span key={company} className="text-lg font-semibold text-zinc-400 hover:text-zinc-600 transition-colors cursor-default">
              {company}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}