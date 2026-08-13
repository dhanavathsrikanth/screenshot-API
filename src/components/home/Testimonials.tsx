const testimonials = [
  {
    quote:
      "We replaced three internal screenshot services with ScreenshotAPI. It's one endpoint, and the automatic ad and cookie-banner blocking alone saves us hours of cleanup per week.",
    name: "Sarah Chen",
    role: "Staff Engineer, LinkPreview",
    initials: "SC",
    color: "bg-indigo-500",
  },
  {
    quote:
      "The PDF output is flawless. We generate branded PDF reports for thousands of customers and the full-page capture with lazy-loading triggers just works.",
    name: "Marcus Okafor",
    role: "CTO, Reportly",
    initials: "MO",
    color: "bg-violet-500",
  },
  {
    quote:
      "Switching from a self-hosted Puppeteer farm saved us 60% in infra costs. The edge cache makes repeated renders feel instant, and the docs are genuinely great.",
    name: "Lena Fischer",
    role: "Backend Lead, Thumbnailr",
    initials: "LF",
    color: "bg-fuchsia-500",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
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
    <section className="border-b border-[var(--border)] bg-white py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Loved by developers
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Trusted by teams who ship
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            From side projects to high-volume production systems.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="hover-lift flex flex-col rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <Stars />
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${t.color} text-sm font-semibold text-white`}>
                  {t.initials}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
