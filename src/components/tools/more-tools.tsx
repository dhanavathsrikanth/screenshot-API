import Link from "next/link";

const tools = [
  {
    title: "Website Screenshot",
    description: "Capture any website as a PNG, JPEG, or WebP image.",
    href: "/tools",
    icon: "🖼️",
  },
  {
    title: "Full Page Screenshot",
    description: "Capture entire webpages including content below the fold.",
    href: "/tools/full-page",
    icon: "📄",
  },
  {
    title: "URL to PDF",
    description: "Convert any webpage to a downloadable PDF document.",
    href: "/tools/pdf",
    icon: "📑",
  },
];

export function MoreTools({ active }: { active?: string }) {
  return (
    <section className="mt-16">
      <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-6">
        More free tools
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tools.map((tool) => {
          const isActive = active === tool.href;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className={
                isActive
                  ? "rounded-xl border border-indigo-500/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-6 transition-colors"
                  : "rounded-xl border border-[var(--border)] p-6 hover:border-indigo-500/50 transition-colors"
              }
            >
              <span className="text-2xl">{tool.icon}</span>
              <h3 className="mt-4 font-semibold">{tool.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{tool.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
