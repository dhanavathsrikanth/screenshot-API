"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ProjectRow } from "@/app/actions/projects";
import { listProjects } from "@/app/actions/projects";

const PALETTES = [
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300" },
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
  { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300" },
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300" },
  { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
];
function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}
function initials(name: string) {
  const p = name.trim().split(/\s+/).slice(0, 2);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

export function ProjectSwitcher({ projects: initial }: { projects?: ProjectRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const workspaceMatch = pathname.match(/^\/dashboard\/projects\/([^/]+)/);
  const workspaceId = workspaceMatch?.[1] ?? null;

  const [projects, setProjects] = useState<ProjectRow[]>(initial ?? []);
  const [activeId, setActiveId] = useState<string | null>(workspaceId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (initial && initial.length > 0) setProjects(initial);
    else {
      listProjects().then(setProjects).catch(() => {});
    }
  }, [initial]);

  useEffect(() => {
    if (workspaceId) {
      setActiveId(workspaceId);
      localStorage.setItem("active_project_id", workspaceId);
      return;
    }
    const saved = typeof window !== "undefined" ? localStorage.getItem("active_project_id") : null;
    if (saved && projects.some((p) => p.id === saved)) setActiveId(saved);
    else if (projects[0]) setActiveId(projects[0].id);
  }, [projects, workspaceId]);

  useEffect(() => {
    if (activeId && !workspaceId) localStorage.setItem("active_project_id", activeId);
  }, [activeId, workspaceId]);

  const active = projects.find((p) => p.id === activeId) ?? projects.find((p) => p.id === workspaceId) ?? projects[0] ?? null;

  const openWorkspace = (id: string) => {
    setActiveId(id);
    localStorage.setItem("active_project_id", id);
    setOpen(false);
    router.push(`/dashboard/projects/${id}`);
  };
  if (!active || projects.length === 0) {
    return (
      <Link href="/dashboard/projects" className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2.5 text-xs text-[var(--dim)] hover:bg-[var(--muted)]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">+</span>
        Create a project
      </Link>
    );
  }

  const pal = paletteFor(active.name);
  return (
    <div className="mx-3 mb-3 relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-left shadow-sm hover:border-[var(--card-hover-border)] hover:shadow-sm transition-all"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${pal.bg} ${pal.text}`}>{initials(active.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold leading-none">{active.name}</span>
          <span className="block truncate font-mono text-[11px] leading-none text-[var(--dim)]">{active.slug ?? active.id.slice(0, 8)}</span>
        </span>
        <svg className={`h-3.5 w-3.5 shrink-0 text-[var(--dim)] transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
            <div className="max-h-64 overflow-auto py-1">
              {projects.map((p) => {
                const pp = paletteFor(p.name);
                const isActive = p.id === active.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => openWorkspace(p.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--muted)] ${isActive ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${pp.bg} ${pp.text}`}>{initials(p.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{p.name}</span>
                      <span className="block truncate text-[11px] text-[var(--dim)]">{p.api_key_count ?? 0} keys · {(p.usage_30d ?? 0).toLocaleString()} req</span>
                    </span>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-[var(--border)] bg-[var(--muted)]/40 p-2 flex gap-1.5">
              <button onClick={() => openWorkspace(active.id)} className="flex-1 rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-center text-xs font-medium text-white">Open workspace</button>
              <Link href={`/dashboard/history?project=${active.id}`} onClick={() => setOpen(false)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs hover:bg-[var(--muted)]">History</Link>
              <Link href="/dashboard/projects" onClick={() => setOpen(false)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs">All</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
