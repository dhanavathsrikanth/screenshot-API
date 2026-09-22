export default function DashboardLoading() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard" role="status">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-[var(--muted)]" />
          <div className="h-4 w-72 animate-pulse rounded bg-[var(--muted)]" />
        </div>
        <div className="hidden h-8 w-24 animate-pulse rounded-md bg-[var(--muted)] sm:block" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {["one", "two", "three"].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card)]" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--card)]" />
    </div>
  );
}
