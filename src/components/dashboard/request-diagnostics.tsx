"use client";

import { useState, useTransition, useRef } from "react";
import { lookupRequestTrace, recentRequests } from "@/app/actions/support";
import type { RequestTrace, RecentRequestRow } from "@/app/actions/support";

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--dim)] dark:text-[var(--dim)]">{label}</p>
      <p className={`mt-0.5 text-sm text-[var(--ink)] dark:text-[var(--ink)] ${mono ? "font-mono text-xs break-all" : "break-words"}`}>{value ?? <span className="text-[var(--line)] dark:text-[var(--dim)]">—</span>}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: number | null }) {
  if (status === null) return <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--dim)] dark:bg-[var(--muted)] dark:text-[var(--dim)]">—</span>;
  const ok = status >= 200 && status < 300;
  const client = status >= 400 && status < 500;
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold ${ok ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : client ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
      {status}
    </span>
  );
}

export function RequestDiagnostics({ initialRequests }: { initialRequests: RecentRequestRow[] }) {
  const [query, setQuery] = useState("");
  const [trace, setTrace] = useState<RequestTrace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<RecentRequestRow[]>(initialRequests);
  const [isPending, startTransition] = useTransition();
  const resultsRef = useRef<HTMLDivElement>(null);

  function runLookup(id: string) {
    const trimmed = id.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    setError(null);
    setTrace(null);
    startTransition(async () => {
      try {
        const result = await lookupRequestTrace(trimmed);
        setTrace(result);
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lookup failed. Please try again.");
      }
    });
  }

  function refreshRecent() {
    startTransition(async () => {
      try {
        setRequests(await recentRequests(25));
      } catch {
        // Leave the existing list in place on failure.
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="eyebrow text-[var(--dim)]">Request Diagnostics</h2>
        <button
          type="button"
          onClick={refreshRecent}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--dim)] dark:text-[var(--dim)] hover:bg-[var(--muted)] dark:hover:bg-[var(--muted)] disabled:opacity-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="card p-5">
        <p className="text-sm text-[var(--dim)] dark:text-[var(--dim)]">
          Look up a request by its ID from the <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">X-Request-Id</code> header
          or the <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs">requestId</code> field in an error envelope. Shows the request trace,
          job, usage event, and the customer account behind it.
        </p>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            runLookup(query);
          }}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. 4f7b2c9a-…"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--ink)] dark:text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={isPending || !query.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            )}
            Look up
          </button>
        </form>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
        )}
      </div>

      <div ref={resultsRef} className="scroll-mt-6 space-y-3">
        {trace && (
          <>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 dark:bg-[var(--card)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Request trace</p>
                  <p className="mt-0.5 font-mono text-xs text-[var(--dim)] dark:text-[var(--dim)] break-all">{trace.requestId}</p>
                </div>
                {trace.request ? (
                  <StatusBadge status={trace.request.status_code} />
                ) : (
                  <span className="rounded-full bg-[var(--muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--dim)] dark:bg-[var(--muted)] dark:text-[var(--dim)]">
                    No persisted trace
                  </span>
                )}
              </div>

              {trace.request ? (
                <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="Endpoint" value={trace.request.endpoint} mono />
                  <Field label="Method" value={trace.request.method} mono />
                  <Field label="Latency" value={trace.request.latency_ms !== null ? `${trace.request.latency_ms} ms` : null} mono />
                  <Field label="Cache" value={trace.request.cached ? "Hit" : "Miss"} />
                  <Field label="IP hash" value={trace.request.ip_hash} mono />
                  <Field label="User agent" value={trace.request.user_agent} />
                  <Field label="Created" value={trace.request.created_at ? new Date(trace.request.created_at).toLocaleString() : null} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--dim)] dark:text-[var(--dim)]">
                  This request ID was not persisted to <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-xs">api_requests</code>.
                  Requests rejected before processing (validation, 401, 403, 429) still return this ID in the response, but only accepted
                  screenshot requests are recorded. Ask the customer for the full response body — the error envelope includes{" "}
                  <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-xs">error.code</code>,{" "}
                  <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-xs">error.message</code>, and{" "}
                  <code className="rounded bg-[var(--muted)] px-1 py-0.5 font-mono text-xs">error.requestId</code>.
                </p>
              )}
            </div>

            {trace.user && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 dark:bg-[var(--card)]">
                <p className="text-sm font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Account</p>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="User ID" value={trace.user.id} mono />
                  <Field label="Email" value={trace.user.email} />
                  <Field label="Name" value={[trace.user.first_name, trace.user.last_name].filter(Boolean).join(" ") || null} />
                  <Field label="Plan" value={trace.user.plan ? trace.user.plan[0].toUpperCase() + trace.user.plan.slice(1) : null} />
                </div>
                {trace.project && (
                  <p className="mt-3 text-sm text-[var(--dim)] dark:text-[var(--dim)]">
                    Project: <span className="font-medium text-[var(--ink)] dark:text-[var(--ink)]">{trace.project.name}</span>{" "}
                    <span className="font-mono text-xs">{trace.project.id}</span>
                  </p>
                )}
                {trace.apiKey && (
                  <p className="mt-1 text-sm text-[var(--dim)] dark:text-[var(--dim)]">
                    API key: <span className="font-mono text-xs">{trace.apiKey.key_prefix}…</span>{" "}
                    <span className="font-medium text-[var(--ink)] dark:text-[var(--ink)]">{trace.apiKey.name}</span>{" "}
                    ({trace.apiKey.environment}, {trace.apiKey.is_active ? "active" : "revoked"})
                  </p>
                )}
              </div>
            )}

            {trace.job && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 dark:bg-[var(--card)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Screenshot job</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${trace.job.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : trace.job.status === "failed" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                    {trace.job.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  <Field label="Job ID" value={trace.job.id} mono />
                  <Field label="Screenshot ID" value={trace.job.screenshot_id} mono />
                  <Field label="Format" value={trace.job.format} mono />
                  <Field label="Size" value={trace.job.size_bytes !== null ? `${(trace.job.size_bytes / 1024).toFixed(1)} KB` : null} mono />
                  <Field label="Credits charged" value={String(trace.job.credits_charged)} mono />
                  <Field label="Started" value={trace.job.started_at ? new Date(trace.job.started_at).toLocaleString() : null} />
                  <Field label="Completed" value={trace.job.completed_at ? new Date(trace.job.completed_at).toLocaleString() : null} />
                </div>
                {trace.job.error_code && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-950/30">
                    <p className="font-mono text-xs font-semibold text-red-700 dark:text-red-400">{trace.job.error_code}</p>
                    <p className="mt-1 text-sm text-red-600 dark:text-red-300 break-words">{trace.job.error_message}</p>
                  </div>
                )}
                {trace.job.storage_url && (
                  <a
                    href={trace.job.storage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
                  >
                    Open screenshot
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            {trace.usageEvents.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 dark:bg-[var(--card)]">
                <p className="text-sm font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Usage events</p>
                <ul className="mt-3 space-y-2">
                  {trace.usageEvents.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--ink)] dark:text-[var(--ink)]">{e.event_type}</code>
                      <span className="font-mono text-xs text-[var(--dim)]">{e.units} units</span>
                      {e.duration_ms !== null && <span className="font-mono text-xs text-[var(--dim)]">{e.duration_ms} ms</span>}
                      <span className="text-xs text-[var(--dim)] dark:text-[var(--dim)]">{new Date(e.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] dark:bg-[var(--card)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="px-4 py-3 font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Request ID</th>
              <th className="px-4 py-3 font-semibold text-[var(--ink)] dark:text-[var(--ink)]">User</th>
              <th className="px-4 py-3 font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Endpoint</th>
              <th className="px-4 py-3 font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Status</th>
              <th className="px-4 py-3 font-semibold text-[var(--ink)] dark:text-[var(--ink)]">Latency</th>
              <th className="px-4 py-3 font-semibold text-[var(--ink)] dark:text-[var(--ink)]">When</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-[var(--dim)]">
                  No API requests recorded yet.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={`${r.request_id}-${r.created_at}`} className="hover:bg-[var(--muted)]/40">
                  <td className="px-4 py-3">
                    {r.request_id ? (
                      <button
                        type="button"
                        onClick={() => r.request_id && runLookup(r.request_id)}
                        className="font-mono text-xs text-orange-600 hover:underline dark:text-orange-400 text-left break-all max-w-[220px]"
                        title="Look up this request"
                      >
                        {r.request_id}
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--line)] dark:text-[var(--dim)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--dim)] dark:text-[var(--dim)]">
                    {r.email ?? <span className="text-[var(--line)] dark:text-[var(--dim)]">{r.user_id.slice(0, 8)}…</span>}
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--ink)] dark:text-[var(--ink)]">{r.method} {r.endpoint}</code>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status_code} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--dim)]">{r.latency_ms !== null ? `${r.latency_ms} ms` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-[var(--dim)] dark:text-[var(--dim)]">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {r.request_id && (
                      <button
                        type="button"
                        onClick={() => r.request_id && runLookup(r.request_id)}
                        className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--dim)] dark:text-[var(--dim)] hover:bg-[var(--muted)] dark:hover:bg-[var(--muted)] transition-colors"
                      >
                        Inspect
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
