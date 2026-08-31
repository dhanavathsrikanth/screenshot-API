import type { DashboardAccessStatus } from "@/app/actions/dashboard-access";

export function DataAccessBanner({
  status,
  title = "Unable to load dashboard data",
}: {
  status: DashboardAccessStatus;
  title?: string;
}) {
  if (status.ok) return null;

  const isClerkMismatch =
    status.issue === "clerk_supabase_mismatch" || status.issue === "auth_token_missing";

  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
      <p className="font-semibold mb-1">{title}</p>
      {status.message && <p className="text-xs opacity-90">{status.message}</p>}
      {isClerkMismatch && (
        <p className="mt-2 text-xs leading-relaxed">
          This usually means your Clerk instance doesn&apos;t match what Supabase expects. In the Supabase
          dashboard, open{" "}
          <code className="font-mono bg-red-100 dark:bg-red-900/50 px-1 rounded">
            Authentication → Providers → Clerk
          </code>{" "}
          and set the Clerk domain to the same instance your app uses (test keys locally, live keys in
          production). Restart the app after changing it.
        </p>
      )}
      {status.issue === "quota_missing" && (
        <p className="mt-2 text-xs leading-relaxed">
          Your captures may still work via the API, but usage counters won&apos;t display until a quota row
          exists. Try capturing once from the Playground or contact support if this persists.
        </p>
      )}
      {status.issue === "database_error" && (
        <p className="mt-2 text-xs leading-relaxed">
          A temporary database error occurred. Refresh the page. If it continues, check Supabase status and
          your environment variables.
        </p>
      )}
    </div>
  );
}

export function DashboardLoadErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold mb-1">Could not load account data</p>
      <p className="text-xs opacity-90">{message}</p>
      <p className="mt-2 text-xs">Refresh the page. Stats below may be incomplete until this is resolved.</p>
    </div>
  );
}
