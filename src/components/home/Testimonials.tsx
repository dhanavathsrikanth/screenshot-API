const testimonials = [
  {
    quote:
      "We replaced three internal screenshot services with ScreenshotAPI. It's one endpoint, and the automatic ad and cookie-banner blocking alone saves us hours of cleanup per week.",
    name: "Sarah Chen",
    role: "Staff Engineer, LinkPreview",
    initials: "SC",
  },
  {
    quote:
      "The PDF output is flawless. We generate branded PDF reports for thousands of customers and the full-page capture with lazy-loading triggers just works.",
    name: "Marcus Okafor",
    role: "CTO, Reportly",
    initials: "MO",
  },
  {
    quote:
      "Switching from a self-hosted Puppeteer farm saved us 60% in infra costs. The edge cache makes repeated renders feel instant, and the docs are genuinely great.",
    name: "Lena Fischer",
    role: "Backend Lead, Thumbnailr",
    initials: "LF",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
            clipRule="evenodd"
          />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="mb-16 px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-[18px] font-mono text-xs tracking-[0.08em] text-[var(--dim)] uppercase">
          testimonials
        </h2>
        <div className="grid grid-cols-1 gap-px border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.name} className="bg-white p-[22px] dark:bg-[var(--card)]">
              <Stars />
              <blockquote className="mt-3 text-[13px] leading-[1.55] text-[var(--dim)]">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[10px] font-semibold text-[var(--background)]">
                  {t.initials}
                </span>
                <div>
                  <p className="text-[12px] font-semibold">{t.name}</p>
                  <p className="text-[11px] text-[var(--dim)]">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
