export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="dashboard-hero-label mb-2">{eyebrow}</p>
        <h1 className="text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-[var(--ink)] sm:text-[2rem]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-5 text-[var(--dim)]">{description}</p>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
