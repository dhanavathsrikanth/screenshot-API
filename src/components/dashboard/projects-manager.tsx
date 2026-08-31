"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  createProject,
  renameProject,
  deleteProject,
  type ProjectRow,
} from "@/app/actions/projects";
import { ProjectUploadForm } from "@/components/dashboard/project-upload-form";
import type { UploadDestinationPublic } from "@/app/actions/project-upload";

interface ProjectsManagerProps {
  initialProjects: ProjectRow[];
  destinations: UploadDestinationPublic[];
  customerUploadAllowed: boolean;
}

function UsageTrend({ trend }: { trend: { date: string; count: number }[] }) {
  const max = Math.max(...trend.map((t) => t.count), 1);
  return (
    <div>
      <p className="section-title mb-2">Usage (7 days)</p>
      <div className="flex items-end gap-1 h-10">
        {trend.map((t) => (
          <div
            key={t.date}
            className="flex-1 rounded-sm bg-orange-500/70 min-h-[2px]"
            style={{ height: `${Math.max((t.count / max) * 100, t.count > 0 ? 12 : 2)}%` }}
            title={`${t.date}: ${t.count} requests`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--dim)]">
        <span>{trend[0]?.date.slice(5)}</span>
        <span>{trend[trend.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

export function ProjectsManager({ initialProjects, destinations, customerUploadAllowed }: ProjectsManagerProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newName.trim()) return;
      setError(null);
      startTransition(async () => {
        try {
          const created = await createProject(newName.trim());
          setProjects((prev) => [
            { ...created, api_key_count: 0, screenshot_count: 0, webhook_count: 0, usage_30d: 0 },
            ...prev,
          ]);
          setNewName("");
          setShowCreate(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create project.");
        }
      });
    },
    [newName]
  );

  const handleRename = useCallback(
    (id: string) => {
      if (!editName.trim()) return;
      setError(null);
      startTransition(async () => {
        try {
          await renameProject(id, editName.trim());
          setProjects((prev) =>
            prev.map((p) => (p.id === id ? { ...p, name: editName.trim() } : p))
          );
          setEditingId(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to rename project.");
        }
      });
    },
    [editName]
  );

  const handleDelete = useCallback((id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteProject(id);
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setDeleteConfirmId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete project.");
      }
    });
  }, []);

  return (
    <div>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--dim)]">
          {projects.length} project{projects.length !== 1 ? "s" : ""} · organize keys, screenshots, and webhooks
        </p>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            Create Project
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="flex gap-3 mb-4">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name (e.g. production, staging, client-a)"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            autoFocus
            maxLength={64}
          />
          <button
            type="submit"
            disabled={isPending || !newName.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(false);
              setNewName("");
            }}
            className="btn-secondary"
          >
            Cancel
          </button>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="card border-dashed p-12 text-center">
          <div className="text-[var(--dim)] mb-3">
            <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <p className="text-sm text-[var(--dim)] mb-1">No projects yet</p>
          <p className="text-xs text-[var(--dim)]">
            Create a project to keep your API keys, screenshots, and usage organized.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="card card-lift p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3.75 3h12m-.75 4.5h.75m-.75 3h.75m-.75 3h.75" />
                    </svg>
                  </span>
                  {editingId === project.id ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={64}
                        className="w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(project.id)}
                        disabled={isPending || !editName.trim()}
                        className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-secondary text-xs py-1.5 px-2.5"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={project.name}>
                        {project.name}
                      </p>
                      <p className="text-xs text-[var(--dim)] font-mono mt-0.5">
                        {project.slug ?? project.id.slice(0, 8)}
                      </p>
                    </div>
                  )}
                </div>
                {editingId !== project.id && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditingId(project.id);
                        setEditName(project.name);
                      }}
                      className="btn-secondary text-xs py-1.5 px-2.5"
                    >
                      Rename
                    </button>
                    {deleteConfirmId === project.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(project.id)}
                          disabled={isPending}
                          className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="btn-secondary text-xs py-1.5 px-2.5"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(project.id)}
                        className="rounded-lg border border-red-200 dark:border-red-800 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
                <div>
                  <p className="section-title">API keys</p>
                  <p className="metric-value mt-1 text-[var(--ink)]">{project.api_key_count ?? 0}</p>
                </div>
                <div>
                  <p className="section-title">Screenshots</p>
                  <p className="metric-value mt-1 text-[var(--ink)]">{project.screenshot_count ?? 0}</p>
                </div>
                <div>
                  <p className="section-title">Webhooks</p>
                  <p className="metric-value mt-1 text-[var(--ink)]">{project.webhook_count ?? 0}</p>
                </div>
                <div>
                  <p className="section-title">Usage (30d)</p>
                  <p className="metric-value mt-1 text-[var(--ink)]">{project.usage_30d ?? 0}</p>
                </div>
              </div>

              {project.usage_trend && project.usage_trend.some((t) => t.count > 0) && (
                <UsageTrend trend={project.usage_trend} />
              )}

              <ProjectUploadForm
                projectId={project.id}
                allowed={customerUploadAllowed}
                initial={destinations.find((d) => d.project_id === project.id) ?? null}
              />

              <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                <Link
                  href={`/dashboard/projects/${project.id}/analytics`}
                  className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                >
                  Analytics
                </Link>
                <span className="text-[var(--line)]">·</span>
                <Link
                  href={`/dashboard/history?project=${project.id}`}
                  className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                >
                  View history
                </Link>
                <span className="text-[var(--line)]">·</span>
                <Link
                  href="/dashboard/api-keys"
                  className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                >
                  API keys
                </Link>
                <span className="text-[var(--line)]">·</span>
                <Link
                  href="/dashboard/webhooks"
                  className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
                >
                  Webhooks
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
