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
      className={`card card-lift p-6 flex flex-col justify-between ${
        accent
          ? "border-indigo-500/40 bg-indigo-50/50 dark:bg-indigo-950/30"
          : ""
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <p className="eyebrow text-zinc-400 leading-relaxed">{label}</p>
          <div
            className={`flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-xl ${
              accent
                ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {icon}
          </div>
        </div>
        <p className="text-3xl font-semibold mt-4 tracking-tight">{value}</p>
      </div>
      {sublabel && (
        <p className="text-xs text-zinc-500 mt-4">{sublabel}</p>
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
      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
        <span>{used.toLocaleString()} used</span>
        <span>{limit.toLocaleString()} limit</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
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
