interface StatsCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  accent?: boolean;
}

export function StatsCard({ label, value, sublabel, icon, accent }: StatsCardProps) {
  return (
    <div
      className={`card card-lift relative overflow-hidden p-5 flex flex-col justify-between ${
        accent
          ? "border-orange-500/40 bg-orange-50/40 dark:bg-orange-950/20"
          : "bg-[var(--card)]"
      }`}
    >
      {accent && (
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[var(--accent)] to-[var(--primary-hover)]"
          aria-hidden="true"
        />
      )}
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="section-title leading-relaxed">{label}</p>
          <div
            className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl ${
              accent
                ? "bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400"
                : "bg-[var(--muted)] text-[var(--dim)]"
            }`}
          >
            {icon}
          </div>
        </div>
        <p className="metric-value mt-4 text-[var(--ink)]">{value}</p>
      </div>
      {sublabel && (
        <p className="mt-3 text-xs text-[var(--dim)]">{sublabel}</p>
      )}
    </div>
  );
}

interface UsageBarProps {
  used: number;
  limit: number;
}

export function UsageBar({ used, limit }: UsageBarProps) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isHigh = pct >= 80;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-[var(--dim)] mb-1">
        <span>{used.toLocaleString()} used</span>
        <span>{limit.toLocaleString()} limit</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--line)] dark:bg-[var(--muted)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isHigh
              ? "bg-amber-500"
              : "bg-[var(--primary)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
