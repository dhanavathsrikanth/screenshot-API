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
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <p className="eyebrow text-orange-600 mb-2">{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="text-sm text-[var(--dim)] mt-2">{description}</p>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
