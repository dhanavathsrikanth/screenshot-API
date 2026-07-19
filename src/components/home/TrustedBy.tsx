"use client";

export function TrustedBy() {
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