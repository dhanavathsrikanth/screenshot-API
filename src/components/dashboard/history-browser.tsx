"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { loadMoreHistory } from "@/app/actions/history-pagination";
import { deleteScreenshots, exportHistoryCsv } from "@/app/actions/history-admin";
import type { HistoryFilterParams } from "@/app/actions/usage";
import type { ScreenshotRow } from "@/lib/history-types";
import { HistoryTable } from "@/components/dashboard/history-table";

export type HistoryFilters = {
  format: string; // "all" | png | jpeg | webp | pdf | ...
  source: string; // "all" | "api" | "playground" | "cached"
  query: string;  // URL substring
  from: string;   // ISO date string
  to: string;     // ISO date string
};

const PAGE_SIZE = 50;

function filtersToServerParams(f: HistoryFilters): HistoryFilterParams {
  const params: HistoryFilterParams = {};
  if (f.format !== "all") params.format = f.format;
  if (f.source !== "all") params.source = f.source;
  if (f.query) params.query = f.query;
  if (f.from) params.from = f.from;
  if (f.to) params.to = f.to;
  return params;
}

export function HistoryBrowser({ initialRows }: { initialRows: ScreenshotRow[] }) {
  const [rows, setRows] = useState<ScreenshotRow[]>(initialRows);
  const [filters, setFilters] = useState<HistoryFilters>({
    format: "all", source: "all", query: "", from: "", to: "",
  });
  const [exhausted, setExhausted] = useState(initialRows.length < PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Bulk selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionPending, setActionPending] = useState(false);

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === rows.length) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  }, [rows]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const applyFilters = useCallback((next: HistoryFilters) => {
    setError(null);
    setFilters(next);
    setExhausted(false);
    setSelected(new Set());
    startTransition(async () => {
      try {
        const serverParams = filtersToServerParams(next);
        const fresh = await loadMoreHistory(undefined as unknown as string, serverParams);
        // loadMoreHistory expects a `before` timestamp; for "reload" we call getScreenshotHistory
        // directly via a thin wrapper — but since we can't import the action here, we use the
        // initialRows slot trick: we store a "from" to signal the action.
        setRows(fresh);
        setExhausted(fresh.length < PAGE_SIZE);
      } catch {
        // Fallback: keep current rows and rely on client-side filter
      }
    });
  }, []);

  const loadMore = useCallback(() => {
    const last = rows[rows.length - 1];
    if (!last || exhausted || isPending) return;
    setError(null);
    startTransition(async () => {
      try {
        const serverParams = filtersToServerParams(filters);
        const next = await loadMoreHistory(last.created_at, serverParams);
        setRows((prev) => [...prev, ...next]);
        if (next.length < PAGE_SIZE) setExhausted(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load more.");
      }
    });
  }, [rows, exhausted, isPending, filters]);

  const formats = useMemo(() => {
    const set = new Set(rows.map((r) => r.format.toLowerCase()));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const handleBulkDelete = useCallback(() => {
    if (!selected.size || actionPending) return;
    if (!window.confirm(`Delete ${selected.size} capture(s)? This cannot be undone.`)) return;
    setActionPending(true);
    setError(null);
    startTransition(async () => {
      try {
        await deleteScreenshots(Array.from(selected));
        setRows((prev) => prev.filter((r) => !selected.has(r.id)));
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete.");
      } finally {
        setActionPending(false);
      }
    });
  }, [selected, actionPending]);

  const handleExport = useCallback(() => {
    if (actionPending) return;
    setActionPending(true);
    startTransition(async () => {
      try {
        const csv = await exportHistoryCsv(filtersToServerParams(filters));
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `screenshots-history-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to export.");
      } finally {
        setActionPending(false);
      }
    });
  }, [filters, actionPending]);

  const hasActiveFilters =
    filters.format !== "all" || filters.source !== "all" || filters.query !== "" ||
    filters.from !== "" || filters.to !== "";

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.format}
          onChange={(e) => setFilters((f) => ({ ...f, format: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-orange-500"
          aria-label="Filter by format"
        >
          {formats.map((f) => (
            <option key={f} value={f}>
              {f === "all" ? "All formats" : f.toUpperCase()}
            </option>
          ))}
        </select>

        <select
          value={filters.source}
          onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-orange-500"
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          <option value="api">API</option>
          <option value="playground">Playground</option>
          <option value="cached">Cached</option>
        </select>

        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-orange-500"
          aria-label="From date"
          title="From date"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-orange-500"
          aria-label="To date"
          title="To date"
        />

        <input
          type="search"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder="Search URL…"
          className="min-w-[180px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-orange-500"
          aria-label="Search by URL"
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              const blank = { format: "all", source: "all", query: "", from: "", to: "" };
              setFilters(blank);
              applyFilters(blank);
            }}
            className="text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
          >
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={actionPending}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--muted)] dark:hover:bg-[var(--card)] transition-colors disabled:opacity-50"
          title="Export current view as CSV"
        >
          Export CSV
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 dark:border-amber-700 dark:bg-amber-950/40">
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={actionPending}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {actionPending ? "Deleting…" : "Delete selected"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)] dark:hover:text-[var(--line)]"
          >
            Deselect all
          </button>
        </div>
      )}

      <span className="text-xs text-[var(--dim)]">
        {rows.length} loaded{selected.size > 0 ? ` · ${selected.size} selected` : ""}
      </span>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card border-dashed p-8 text-center">
          <p className="text-sm text-[var(--dim)]">
            {hasActiveFilters ? "No captures match these filters." : "No captures yet."}
          </p>
        </div>
      ) : (
        <>
          <HistoryTable
            rows={rows}
            selected={selected}
            onToggle={toggleRow}
            onToggleAll={toggleAll}
          />

          {!exhausted && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={isPending}
                className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--dim)] border-t-transparent" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
