"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAdminNotificationRead } from "@/app/actions/admin-notifications";
import type { AdminNotificationRow } from "@/app/actions/admin-notifications";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/50 dark:text-red-400",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-400",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/50 dark:text-blue-400",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export function StorageAlerts({
  notifications,
}: {
  notifications: AdminNotificationRow[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const unread = notifications.filter((n) => !n.read_at);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Operational Alerts</h2>
        {unread.length > 0 && (
          <span className="rounded-full bg-orange-600 text-white text-xs font-medium px-2.5 py-1">
            {unread.length} new
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-5 text-sm text-[var(--dim)]">
          No alerts. Storage fallbacks and failures will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const severity = n.severity in SEVERITY_STYLES ? n.severity : "info";
            const meta = (n.metadata ?? {}) as {
              reason?: string;
              failed_storage?: string;
              fallback_storage?: string;
              error?: string;
              secondary_error?: string;
              sourceUrl?: string | null;
            };
            const isUnread = !n.read_at;
            return (
              <div
                key={n.id}
                className={`card p-5 ${isUnread ? "border-l-4 border-l-orange-500" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info}`}
                      >
                        {SEVERITY_LABEL[severity] ?? severity}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--dim)]">
                        {n.type}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{n.title}</p>
                    {n.message && (
                      <p className="mt-1 text-xs text-[var(--dim)] dark:text-[var(--dim)] whitespace-pre-wrap break-words">
                        {n.message}
                      </p>
                    )}

                    {(meta.reason || meta.failed_storage || meta.error || meta.secondary_error) && (
                      <div className="mt-3 rounded-lg bg-[var(--muted)] dark:bg-[var(--card)] p-3 font-mono text-[11px] text-[var(--dim)] space-y-1 break-all">
                        {meta.reason && <div>reason: {meta.reason}</div>}
                        {meta.failed_storage && <div>failed_storage: {meta.failed_storage}</div>}
                        {meta.fallback_storage && <div>fallback_storage: {meta.fallback_storage}</div>}
                        {meta.error && <div className="text-red-600 dark:text-red-400">error: {meta.error}</div>}
                        {meta.secondary_error && (
                          <div className="text-red-600 dark:text-red-400">secondary_error: {meta.secondary_error}</div>
                        )}
                        {meta.sourceUrl && <div>url: {meta.sourceUrl}</div>}
                      </div>
                    )}

                    <p className="mt-2 text-[11px] text-[var(--dim)]">
                      {new Date(n.created_at).toLocaleString()}
                      {n.user_id ? ` · user ${n.user_id.slice(0, 8)}…` : ""}
                    </p>
                  </div>
                  {isUnread && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await markAdminNotificationRead(n.id);
                          router.refresh();
                        })
                      }
                      className="flex-shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--dim)] dark:text-[var(--dim)] hover:bg-[var(--muted)] dark:hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
