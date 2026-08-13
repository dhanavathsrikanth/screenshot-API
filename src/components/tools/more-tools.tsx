import Link from "next/link";

const tools = [
  {
    title: "Website Screenshot",
    description: "Capture any website as a PNG, JPEG, or WebP image.",
    href: "/tools",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
      </svg>
    ),
  },
  {
    title: "Full Page Screenshot",
    description: "Capture entire webpages including content below the fold.",
    href: "/tools/full-page",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
      </svg>
    ),
  },
  {
    title: "URL to PDF",
    description: "Convert any webpage to a downloadable PDF document.",
    href: "/tools/pdf",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
];

export function MoreTools({ active }: { active?: string }) {
  return (
    <section className="mt-16">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        More free tools
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        {tools.map((tool) => {
          const isActive = active === tool.href;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className={
                isActive
                  ? "hover-lift rounded-xl border border-indigo-500/60 bg-indigo-50/50 p-6 dark:border-indigo-500/40 dark:bg-indigo-950/20"
                  : "hover-lift rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              }
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-400">
                {tool.icon}
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{tool.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{tool.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
