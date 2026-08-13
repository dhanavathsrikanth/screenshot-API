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
        <p className="eyebrow text-indigo-600">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight mt-2">{title}</h1>
        <p className="text-sm text-zinc-500 mt-1">{description}</p>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
