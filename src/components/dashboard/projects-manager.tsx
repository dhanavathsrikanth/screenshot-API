"use client";

import { useState, useTransition, useCallback } from "react";
import {
  createProject,
  renameProject,
  type ProjectRow,
} from "@/app/actions/projects";

interface ProjectsManagerProps {
  initialProjects: ProjectRow[];
}

export function ProjectsManager({ initialProjects }: ProjectsManagerProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
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
          setProjects((prev) => [created, ...prev]);
          setNewName("");
          setShowCreate(false);
        } catch {
          setError("Failed to create project. Please try again.");
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
        } catch {
          setError("Failed to rename project. Please try again.");
        }
      });
    },
    [editName]
  );

  return (
    <div>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--dim)]">
          {projects.length} project{projects.length !== 1 ? "s" : ""}
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
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
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
            <div
              key={project.id}
              className="rounded-xl border border-[var(--border)] p-5 flex flex-col gap-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3.75 3h12m-.75 4.5h.75m-.75 3h.75m-.75 3h.75" />
                    </svg>
                  </span>
                  {editingId === project.id ? (
                    <div className="flex items-center gap-2 flex-1">
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
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--muted)] dark:hover:bg-[var(--card)]"
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
                <button
                  onClick={() => {
                    setEditingId(project.id);
                    setEditName(project.name);
                  }}
                  className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--dim)] hover:text-[var(--ink)] hover:bg-[var(--muted)] dark:hover:text-[var(--line)] dark:hover:bg-[var(--card)] transition-colors"
                >
                  Rename
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
                <div>
                  <p className="text-xs text-[var(--dim)]">API keys</p>
                  <p className="text-lg font-semibold">{project.api_key_count ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--dim)]">Screenshots</p>
                  <p className="text-lg font-semibold">{project.screenshot_count ?? 0}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
