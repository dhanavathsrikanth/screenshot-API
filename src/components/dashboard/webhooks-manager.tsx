"use client";

import { Fragment, useState, useTransition, useCallback } from "react";
import {
  createWebhookEndpoint,
  updateWebhookEndpoint,
  removeWebhookEndpoint,
  getWebhookDeliveries,
  sendWebhookTest,
  replayWebhookDelivery,
} from "@/app/actions/webhooks";
import type { ProjectRow } from "@/app/actions/projects";

type WebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

type WebhookDelivery = {
  id: string;
  endpoint_id: string;
  event: string;
  status: "pending" | "delivering" | "succeeded" | "failed";
  attempts: number;
  http_status: number | null;
  error: string | null;
  next_retry_at: string | null;
  created_at: string;
  sent_at: string | null;
  payload?: Record<string, unknown>;
};

const EVENT_LABELS: Record<string, string> = {
  "screenshot.completed": "Screenshot completed",
  "screenshot.failed": "Screenshot failed",
  "job.started": "Job started",
  "quota.exceeded": "Quota exceeded",
};

const STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  pending: "bg-[var(--muted)] text-[var(--dim)] dark:bg-[var(--muted)] dark:text-[var(--dim)]",
  delivering: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString();
}

export function WebhooksManager({
  initialEndpoints,
  initialDeliveries,
  projects = [],
}: {
  initialEndpoints: WebhookEndpoint[];
  initialDeliveries: WebhookDelivery[];
  projects?: ProjectRow[];
}) {
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["screenshot.completed", "screenshot.failed"]);
  const [newProjectId, setNewProjectId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editEvents, setEditEvents] = useState<string[]>([]);
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const toggleEvent = useCallback((event: string) => {
    setNewEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }, []);

  const toggleEditEvent = useCallback((event: string) => {
    setEditEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  }, []);

  const projectName = useCallback(
    (projectId: string | null) => {
      if (!projectId) return "Account-wide";
      return projects.find((p) => p.id === projectId)?.name ?? projectId.slice(0, 8);
    },
    [projects]
  );

  const filteredDeliveries =
    deliveryFilter === "all"
      ? deliveries
      : deliveries.filter((d) => d.endpoint_id === deliveryFilter);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!newUrl.trim()) return;
      if (newEvents.length === 0) {
        setError("Select at least one event.");
        return;
      }
      startTransition(async () => {
        try {
          const result = await createWebhookEndpoint({
            url: newUrl.trim(),
            events: newEvents,
            projectId: newProjectId || null,
          });
          setEndpoints((prev) => [
            {
              id: result.id,
              url: result.url,
              events: result.events,
              is_active: true,
              project_id: result.project_id,
              created_at: result.created_at,
              updated_at: result.updated_at,
            },
            ...prev,
          ]);
          setCreatedSecret({ id: result.id, secret: result.secret });
          setNewUrl("");
          setShowCreateForm(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create webhook.");
        }
      });
    },
    [newUrl, newEvents, newProjectId]
  );

  const startEdit = useCallback((endpoint: WebhookEndpoint) => {
    setEditingId(endpoint.id);
    setEditUrl(endpoint.url);
    setEditEvents([...endpoint.events]);
  }, []);

  const handleSaveEdit = useCallback(
    (id: string) => {
      if (!editUrl.trim() || editEvents.length === 0) {
        setError("URL and at least one event are required.");
        return;
      }
      setError(null);
      startTransition(async () => {
        try {
          const result = await updateWebhookEndpoint(id, { url: editUrl.trim(), events: editEvents });
          setEndpoints((prev) =>
            prev.map((ep) =>
              ep.id === id
                ? {
                    ...ep,
                    url: result.url,
                    events: result.events,
                    updated_at: result.updated_at,
                  }
                : ep
            )
          );
          setEditingId(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to update webhook.");
        }
      });
    },
    [editUrl, editEvents]
  );

  const handleToggle = useCallback((endpoint: WebhookEndpoint) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateWebhookEndpoint(endpoint.id, { is_active: !endpoint.is_active });
        setEndpoints((prev) =>
          prev.map((ep) => (ep.id === endpoint.id ? { ...ep, is_active: result.is_active } : ep))
        );
      } catch {
        setError("Failed to update webhook.");
      }
    });
  }, []);

  const handleRotateSecret = useCallback((id: string) => {
    setError(null);
    setRotatedSecret(null);
    startTransition(async () => {
      try {
        const result = await updateWebhookEndpoint(id, { rotate_secret: true });
        setRotatedSecret({ id, secret: result.secret as string });
        setEndpoints((prev) =>
          prev.map((ep) => (ep.id === id ? { ...ep, updated_at: result.updated_at } : ep))
        );
      } catch {
        setError("Failed to rotate signing secret.");
      }
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await removeWebhookEndpoint(id);
        setEndpoints((prev) => prev.filter((ep) => ep.id !== id));
        setDeliveries((prev) => prev.filter((d) => d.endpoint_id !== id));
        setDeleteConfirmId(null);
      } catch {
        setError("Failed to delete webhook.");
      }
    });
  }, []);

  const refreshDeliveries = useCallback((endpointId?: string) => {
    startTransition(async () => {
      try {
        const rows = await getWebhookDeliveries(endpointId);
        setDeliveries(rows);
      } catch {
        setError("Failed to load deliveries.");
      }
    });
  }, []);

  const handleSendTest = useCallback((id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await sendWebhookTest(id);
        const rows = await getWebhookDeliveries();
        setDeliveries(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send test delivery.");
      }
    });
  }, []);

  const handleReplay = useCallback((deliveryId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await replayWebhookDelivery(deliveryId);
        setDeliveries((prev) =>
          prev.map((d) =>
            d.id === deliveryId
              ? { ...d, status: "pending" as const, attempts: 0, http_status: null, error: null, sent_at: null }
              : d
          )
        );
        setTimeout(() => refreshDeliveries(), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to replay delivery.");
      }
    });
  }, [refreshDeliveries]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {createdSecret && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
            Webhook endpoint created
          </p>
          <p className="text-xs text-green-700 dark:text-green-400 mb-3">
            Signing secret — copy it now. It is shown only once.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-green-100 dark:bg-green-900/50 rounded px-3 py-2 font-mono break-all text-green-800 dark:text-green-300">
              {createdSecret.secret}
            </code>
            <button
              onClick={() => copy(createdSecret.secret)}
              className="flex-shrink-0 rounded-lg border border-green-300 dark:border-green-700 px-3 py-2 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-3">
            Verify signatures with the{" "}
            <code className="font-mono">x-webhook-signature</code> header:
            <code className="font-mono ml-1">t=&lt;unix_ms&gt;,v1=&lt;HMAC-SHA256&gt;</code>.
          </p>
          <button
            onClick={() => setCreatedSecret(null)}
            className="mt-2 text-xs text-green-600 dark:text-green-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {rotatedSecret && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
            New signing secret
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            The old secret is no longer valid. Copy it now.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-amber-100 dark:bg-amber-900/50 rounded px-3 py-2 font-mono break-all text-amber-800 dark:text-amber-300">
              {rotatedSecret.secret}
            </code>
            <button
              onClick={() => copy(rotatedSecret.secret)}
              className="flex-shrink-0 rounded-lg border border-amber-300 dark:border-amber-700 px-3 py-2 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setRotatedSecret(null)}
            className="mt-2 text-xs text-amber-600 dark:text-amber-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--dim)]">
          {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
        </p>
        {!showCreateForm && (
          <button onClick={() => setShowCreateForm(true)} className="btn-primary">
            Add Endpoint
          </button>
        )}
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="card p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)] mb-1.5">
              Endpoint URL
            </label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://your-app.example.com/webhooks/screenshot"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--dim)] mb-1.5">
              Events
            </label>
            <div className="flex flex-wrap gap-3">
              {Object.entries(EVENT_LABELS).map(([event, label]) => (
                <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="h-4 w-4 rounded border-[var(--border)] text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-xs">{label}</span>
                </label>
              ))}
            </div>
          </div>
          {projects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-[var(--dim)] mb-1.5">
                Project scope
              </label>
              <select
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Account-wide (all projects)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} only
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--dim)]">
                Scoped endpoints only receive events from that project&apos;s API keys.
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending || !newUrl.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create Endpoint"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreateForm(false); setNewUrl(""); }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {endpoints.length === 0 ? (
        <div className="card border-dashed p-10 text-center">
          <div className="text-[var(--dim)] mb-3">
            <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
          <p className="text-sm text-[var(--dim)] mb-1">No webhook endpoints yet</p>
          <p className="text-xs text-[var(--dim)]">
            Receive a signed HTTP POST when screenshots complete or fail.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {endpoints.map((endpoint) => (
            <div key={endpoint.id} className="card p-4 space-y-3">
              {editingId === endpoint.id ? (
                <div className="space-y-3">
                  <input
                    type="url"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(EVENT_LABELS).map(([event, label]) => (
                      <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editEvents.includes(event)}
                          onChange={() => toggleEditEvent(event)}
                          className="h-4 w-4 rounded border-[var(--border)] text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-xs">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(endpoint.id)}
                      disabled={isPending}
                      className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                    >
                      Save changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{endpoint.url}</p>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        endpoint.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-[var(--muted)] text-[var(--dim)]"
                      }`}
                    >
                      {endpoint.is_active ? "Active" : "Paused"}
                    </span>
                    <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--dim)]">
                      {projectName(endpoint.project_id)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {endpoint.events.map((event) => (
                      <span
                        key={event}
                        className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 ring-1 ring-inset ring-orange-500/20"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => startEdit(endpoint)}
                    disabled={isPending}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleSendTest(endpoint.id)}
                    disabled={isPending}
                    className="btn-secondary text-xs py-1.5 px-3"
                    title="Send a signed test delivery to this endpoint"
                  >
                    Send Test
                  </button>
                  <button
                    onClick={() => handleRotateSecret(endpoint.id)}
                    disabled={isPending}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] dark:hover:bg-[var(--card)] transition-colors"
                    title="Rotate signing secret"
                  >
                    Rotate Secret
                  </button>
                  <button
                    onClick={() => handleToggle(endpoint)}
                    disabled={isPending}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      endpoint.is_active
                        ? "border-[var(--line)] dark:border-[var(--line)] hover:bg-[var(--muted)] dark:hover:bg-[var(--muted)]"
                        : "border-orange-200 dark:border-orange-800 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/50"
                    }`}
                  >
                    {endpoint.is_active ? "Pause" : "Resume"}
                  </button>
                  {deleteConfirmId === endpoint.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(endpoint.id)}
                        disabled={isPending}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                      >
                        {isPending ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] dark:hover:bg-[var(--card)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(endpoint.id)}
                      className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--border)]">
          <h3 className="panel-heading">Recent deliveries</h3>
          <div className="flex items-center gap-2">
            {endpoints.length > 0 && (
              <select
                value={deliveryFilter}
                onChange={(e) => {
                  setDeliveryFilter(e.target.value);
                  if (e.target.value !== "all") refreshDeliveries(e.target.value);
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">All endpoints</option>
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.url.length > 40 ? `${ep.url.slice(0, 40)}…` : ep.url}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => refreshDeliveries(deliveryFilter === "all" ? undefined : deliveryFilter)}
              disabled={isPending}
              className="text-xs text-orange-600 hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredDeliveries.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--dim)]">
              No deliveries yet. Deliveries appear here when events fire.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)] dark:bg-[var(--card)]">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)]">
                    Event
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)]">
                    Attempts
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)]">
                    HTTP
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)]">
                    Error
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-[var(--dim)] dark:text-[var(--dim)]">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map((delivery) => (
                  <Fragment key={delivery.id}>
                  <tr
                    className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)] dark:hover:bg-[var(--card)]/50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <code className="text-xs">{delivery.event}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${STATUS_STYLES[delivery.status] ?? "bg-[var(--muted)] text-[var(--dim)]"}`}>
                        {delivery.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs">{delivery.attempts}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {delivery.http_status ? (
                        <span className={`font-mono text-xs ${delivery.http_status >= 200 && delivery.http_status < 300 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {delivery.http_status}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--dim)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-[var(--dim)] truncate block max-w-[280px]" title={delivery.error ?? undefined}>
                        {delivery.error ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {delivery.payload && (
                          <button
                            onClick={() =>
                              setExpandedDeliveryId(
                                expandedDeliveryId === delivery.id ? null : delivery.id
                              )
                            }
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--dim)] hover:bg-[var(--muted)] transition-colors"
                          >
                            {expandedDeliveryId === delivery.id ? "Hide" : "Payload"}
                          </button>
                        )}
                        <span className="text-xs text-[var(--dim)]">{formatDate(delivery.created_at)}</span>
                        {delivery.status !== "delivering" && (
                          <button
                            onClick={() => handleReplay(delivery.id)}
                            disabled={isPending}
                            className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium text-[var(--dim)] hover:bg-[var(--muted)] transition-colors"
                            title="Replay this delivery with the original payload"
                          >
                            Replay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedDeliveryId === delivery.id && delivery.payload && (
                    <tr key={`${delivery.id}-payload`} className="border-b border-[var(--border)] bg-[var(--muted)]/30">
                      <td colSpan={6} className="px-4 py-3">
                        <pre className="code-block-body text-xs overflow-x-auto">
                          {JSON.stringify(delivery.payload, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
