import { useCases } from "@/lib/marketing";

export function UseCases() {
  return (
    <section className="mb-16 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          who pays for this
        </h2>
        <p className="mb-6 max-w-2xl text-[13px] leading-[1.55] text-[var(--dim)]">
          Give users link previews, page archives, and visual reports without operating Chromium yourself.
          Start with 100 monthly credits, then upgrade as captures become part of your product traffic.
        </p>
        <div className="grid grid-cols-1 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
          {useCases.map((item) => (
            <article key={item.title} className="bg-white p-[22px] dark:bg-[var(--card)]">
              <p className="font-mono text-[11px] text-[var(--accent)]">{item.audience}</p>
              <h3 className="mt-1.5 text-[13px] font-semibold">{item.title}</h3>
              <p className="mt-2.5 text-[13px] leading-[1.55] text-[var(--dim)]">{item.description}</p>
              <p className="mt-3 font-mono text-[10.5px] text-[var(--accent)]">{item.paysFor}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
