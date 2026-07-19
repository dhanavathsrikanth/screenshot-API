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
      className={`rounded-xl border p-6 ${
        accent
          ? "border-indigo-500/50 bg-indigo-50/50 dark:bg-indigo-950/30"
          : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-500 truncate">{label}</p>
          <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
          {sublabel && (
            <p className="text-xs text-zinc-500 mt-1">{sublabel}</p>
          )}
        </div>
        <div
          className={`flex-shrink-0 p-2 rounded-lg ${
            accent
              ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {icon}
        </div>
      </div>
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
              : "bg-indigo-600"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
