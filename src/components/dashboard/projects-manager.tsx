"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import Link from "next/link";
import { createProject, renameProject, deleteProject, type ProjectRow } from "@/app/actions/projects";

// ── avatar palette derived from name hash ─────────────────────────────
const AVATAR_PALETTES = [
  { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", accent: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-900" },
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-700 dark:text-sky-300", accent: "bg-sky-500", ring: "ring-sky-200 dark:ring-sky-900" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", accent: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-900" },
  { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", accent: "bg-violet-500", ring: "ring-violet-200 dark:ring-violet-900" },
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", accent: "bg-rose-500", ring: "ring-rose-200 dark:ring-rose-900" },
  { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", accent: "bg-slate-600", ring: "ring-slate-200 dark:ring-slate-700" },
] as const;

function paletteFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTES[h % AVATAR_PALETTES.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ── sparkline ─────────────────────────────────────────────────────────
function Sparkline({ data, colorClass = "text-orange-500" }: { data: { date: string; count: number }[]; colorClass?: string }) {
  if (!data || data.length === 0) return <div className="h-[28px] w-full flex items-center justify-center text-[11px] text-[var(--dim)]">no data</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 100;
  const h = 28;
  const pad = 2;
  const pts = data.map((d, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (d.count / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const area = `M ${pts[0]} L ${pts.slice(1).join(" L ")} L ${w - pad},${h - pad} L ${pad},${h - pad} Z`;
  const line = `M ${pts.join(" L ")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`w-full h-[28px] ${colorClass}`} preserveAspectRatio="none">
      <path d={area} fill="currentColor" opacity={0.08} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        if (d.count === 0) return null;
        const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
        const y = h - pad - (d.count / max) * (h - pad * 2);
        return <circle key={i} cx={x} cy={y} r={1.5} fill="currentColor" />;
      })}
    </svg>
  );
}

// ── templates ─────────────────────────────────────────────────────────
const TEMPLATES: { name: string; desc: string; icon: string }[] = [
  { name: "Production", desc: "Live traffic", icon: "●" },
  { name: "Staging", desc: "Test before ship", icon: "◐" },
  { name: "Client A", desc: "Per-client isolation", icon: "◇" },
  { name: "Marketing", desc: "Campaign shots", icon: "◆" },
];

interface ProjectsManagerProps {
  initialProjects: ProjectRow[];
}

export function ProjectsManager({ initialProjects }: ProjectsManagerProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "usage" | "keys">("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const getMsg = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err !== null && "message" in err) return String((err as { message: unknown }).message);
    return String(err);
  };

  const filtered = useMemo(() => {
    let r = projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || (p.slug ?? "").toLowerCase().includes(q.toLowerCase()));
    r = [...r].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "usage") return (b.usage_30d ?? 0) - (a.usage_30d ?? 0);
      if (sort === "keys") return (b.api_key_count ?? 0) - (a.api_key_count ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return r;
  }, [projects, q, sort]);

  const stats = useMemo(() => {
    const totalKeys = projects.reduce((s, p) => s + (p.api_key_count ?? 0), 0);
    const totalShots = projects.reduce((s, p) => s + (p.screenshot_count ?? 0), 0);
    const totalUsage = projects.reduce((s, p) => s + (p.usage_30d ?? 0), 0);
    const active = projects.filter((p) => (p.usage_30d ?? 0) > 0).length;
    return { totalKeys, totalShots, totalUsage, active };
  }, [projects]);

  const handleCreate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const c = await createProject(newName.trim());
        setProjects((prev) => [{ ...c, api_key_count: 0, screenshot_count: 0, webhook_count: 0, usage_30d: 0, usage_trend: [] }, ...prev]);
        setNewName(""); setShowCreate(false);
      } catch (err) { setError(getMsg(err) || "Failed to create project."); }
    });
  }, [newName]);

  const handleRename = useCallback((id: string) => {
    if (!editName.trim()) return;
    setError(null);
    startTransition(async () => {
      try { await renameProject(id, editName.trim()); setProjects((p) => p.map((x) => x.id === id ? { ...x, name: editName.trim() } : x)); setEditingId(null); }
      catch (err) { setError(getMsg(err) || "Failed to rename."); }
    });
  }, [editName]);

  const handleDelete = useCallback((row: ProjectRow) => {
    if (deleteConfirm.trim() !== row.name.trim()) { setError(`Type "${row.name}" to confirm.`); return; }
    setError(null);
    startTransition(async () => {
      try { await deleteProject(row.id); setProjects((prev) => prev.filter((p) => p.id !== row.id)); setDeleteTarget(null); setDeleteConfirm(""); }
      catch (err) { setError(getMsg(err) || "Failed to delete."); }
    });
  }, [deleteConfirm]);

  const handleDuplicate = useCallback((row: ProjectRow) => {
    setError(null);
    const dupName = `${row.name} copy`;
    startTransition(async () => {
      try {
        const c = await createProject(dupName);
        setProjects((prev) => [{ ...c, api_key_count: 0, screenshot_count: 0, webhook_count: 0, usage_30d: 0, usage_trend: [] }, ...prev]);
      } catch (err) { setError(getMsg(err) || "Failed to duplicate."); }
    });
  }, []);

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 flex items-center justify-between gap-3">{error}<button onClick={() => setError(null)} className="text-xs underline shrink-0">Dismiss</button></div>}

      {/* toolbar */}
      <div className="card p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dim)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 111-15 7.5 7.5 0 01-1 15z" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="h-9 w-64 rounded-lg border border-[var(--border)] bg-[var(--background)] pl-8 pr-3 text-sm placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="recent">Recent</option>
              <option value="name">Name A–Z</option>
              <option value="usage">Most used</option>
              <option value="keys">Most keys</option>
            </select>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              <button onClick={() => setView("grid")} aria-label="Grid view" className={`h-9 w-9 inline-flex items-center justify-center ${view === "grid" ? "bg-[var(--ink)] text-[var(--card)]" : "bg-[var(--card)] text-[var(--dim)] hover:bg-[var(--muted)]"}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>
              </button>
              <button onClick={() => setView("list")} aria-label="List view" className={`h-9 w-9 inline-flex items-center justify-center border-l border-[var(--border)] ${view === "list" ? "bg-[var(--ink)] text-[var(--card)]" : "bg-[var(--card)] text-[var(--dim)] hover:bg-[var(--muted)]"}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[var(--muted)] px-3 py-1.5 text-xs font-medium text-[var(--dim)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> {stats.active} active
              <span className="text-[var(--border)]">·</span> {stats.totalKeys} keys <span className="text-[var(--border)]">·</span> {stats.totalUsage.toLocaleString()} req 30d
            </span>
            <button onClick={() => setShowCreate(true)} className="btn-primary h-9 whitespace-nowrap">+ New project</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--dim)]">
          <span>{filtered.length} of {projects.length} projects</span>
          {q && <button onClick={() => setQ("")} className="underline hover:text-[var(--ink)]">Clear search</button>}
          <span className="hidden sm:inline text-[var(--border)]">·</span>
          <span>Tip: use projects for <span className="font-medium text-[var(--ink)]">Prod vs Staging</span> or per-client isolation. Keys & webhooks stay scoped.</span>
        </div>
      </div>

      {/* create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <form onSubmit={handleCreate} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[520px] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden">
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight">Create project</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--dim)] max-w-[36ch]">A folder for keys, screenshots & webhooks. Start with one — add more later.</p>
                </div>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-full p-1.5 text-[var(--dim)] hover:bg-[var(--muted)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>
            <div className="px-6 pt-4 pb-2 space-y-4">
              <label className="block">
                <span className="text-xs font-medium">Project name</span>
                <div className="mt-1.5 flex items-center gap-3">
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ${paletteFor(newName || "New").bg} ${paletteFor(newName || "New").text} ${paletteFor(newName || "New").ring}`}>{initials(newName || "NP")}</span>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Production, Client Acme, Staging" autoFocus maxLength={64} className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--dim)]">Slug: <span className="font-mono">{newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "—"}</span> · 64 chars max</p>
              </label>
              <div>
                <p className="text-xs font-medium mb-1.5">Quick start</p>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((t) => (
                    <button key={t.name} type="button" onClick={() => setNewName(t.name)} className={`text-left rounded-xl border p-3 hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors ${newName === t.name ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" : "border-[var(--border)] bg-[var(--muted)]/30"}`}>
                      <span className="text-xs font-semibold flex items-center gap-1.5"><span className="text-[var(--dim)]">{t.icon}</span> {t.name}</span>
                      <span className="text-[11px] text-[var(--dim)]">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--muted)]/40 px-6 py-4">
              <p className="text-[11px] text-[var(--dim)]">Screenshots are stored automatically. Custom bucket optional → Storage.</p>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isPending || !newName.trim()} className="btn-primary disabled:opacity-40">{isPending ? "Creating…" : "Create project"}</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* content */}
      {filtered.length === 0 ? (
        <div className="card border-dashed p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 ring-1 ring-orange-200 dark:ring-orange-900">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="mt-4 text-sm font-semibold">{projects.length === 0 ? "No projects yet" : "No matches"}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[var(--dim)]">{projects.length === 0 ? "Create your first project — it’s a folder that keeps keys, screenshots & webhooks separate. You can keep everything in one folder forever." : `No project matches "${q}". Try another name.`}</p>
          {projects.length === 0 && <button onClick={() => setShowCreate(true)} className="btn-primary mt-5">Create your first project</button>}
        </div>
      ) : view === "list" ? (
        <div className="card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1.6fr_110px_90px_160px_auto] gap-3 border-b border-[var(--border)] bg-[var(--muted)]/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">
            <span>Project</span><span>Usage 30d</span><span>Keys</span><span>Last 7 days</span><span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((project) => {
              const p = paletteFor(project.name);
              const active = (project.usage_30d ?? 0) > 0;
              return (
                <div key={project.id} className="flex flex-col sm:grid sm:grid-cols-[1.6fr_110px_90px_160px_auto] sm:items-center gap-3 px-4 py-3 hover:bg-[var(--muted)]/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`hidden sm:inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ${p.bg} ${p.text}`}>{initials(project.name)}</span>
                    <div className="min-w-0">
                      {editingId === project.id ? (
                        <div className="flex gap-1.5">
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={64} autoFocus className="w-40 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm" />
                          <button onClick={() => handleRename(project.id)} className="rounded-lg bg-[var(--ink)] px-2.5 py-1 text-xs font-medium text-white">Save</button>
                          <button onClick={() => setEditingId(null)} className="btn-secondary px-2 py-1 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <p className="truncate text-sm font-semibold flex items-center gap-1.5">{project.name} <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-300"}`} title={active ? "Active this month" : "Idle"} /></p>
                          <p className="truncate font-mono text-xs text-[var(--dim)]">{project.slug ?? project.id.slice(0, 8)} · {new Date(project.created_at).toLocaleDateString()}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{(project.usage_30d ?? 0).toLocaleString()}</span>
                  <span className="text-sm tabular-nums">{project.api_key_count ?? 0} keys · {project.screenshot_count ?? 0} shots</span>
                  <div className="w-full sm:w-[150px]"><Sparkline data={project.usage_trend ?? []} colorClass={active ? "text-emerald-500" : "text-zinc-400"} /></div>
                  <div className="flex justify-end gap-1.5 flex-wrap">
                    <Link href={`/dashboard/projects/${project.id}/analytics`} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--muted)]">Analytics</Link>
                    <Link href={`/dashboard/history?project=${project.id}`} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs hover:bg-[var(--muted)]">History</Link>
                    <button onClick={() => { setEditingId(project.id); setEditName(project.name); }} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--muted)]">Rename</button>
                    <button onClick={() => handleDuplicate(project)} className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs hover:bg-[var(--muted)]">Duplicate</button>
                    <button onClick={() => { setDeleteTarget(project); setDeleteConfirm(""); }} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-900">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => {
            const p = paletteFor(project.name);
            const active = (project.usage_30d ?? 0) > 0;
            const peak = Math.max(...(project.usage_trend ?? []).map((d) => d.count), 0);
            return (
              <div key={project.id} className="card card-lift group flex flex-col overflow-hidden relative">
                <div className={`h-1 w-full ${p.accent} opacity-80`} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ${p.bg} ${p.text} ${p.ring}`}>{initials(project.name)}</span>
                      <div className="min-w-0 flex-1">
                        {editingId === project.id ? (
                          <div className="flex gap-1.5">
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={64} autoFocus className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm" />
                            <button onClick={() => handleRename(project.id)} className="rounded-lg bg-[var(--ink)] px-2.5 py-1 text-xs font-medium text-white">Save</button>
                            <button onClick={() => setEditingId(null)} className="btn-secondary px-2 py-1 text-xs">Cancel</button>
                          </div>
                        ) : (
                          <>
                            <p className="truncate text-sm font-semibold flex items-center gap-1.5" title={project.name}>{project.name}
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${active ? "bg-emerald-500" : "bg-zinc-300"}`} title={active ? "Active" : "Idle"} />
                            </p>
                            <p className="truncate font-mono text-xs text-[var(--dim)]">{project.slug ?? project.id.slice(0, 8)} · {new Date(project.created_at).toLocaleDateString()}</p>
                          </>
                        )}
                      </div>
                    </div>
                    {editingId !== project.id && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => handleDuplicate(project)} title="Duplicate" className="rounded-lg p-1.5 text-[var(--dim)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" /></svg></button>
                        <button onClick={() => { setEditingId(project.id); setEditName(project.name); }} title="Rename" className="rounded-lg p-1.5 text-[var(--dim)] hover:bg-[var(--muted)] hover:text-[var(--ink)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M11 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                        <button onClick={() => { setDeleteTarget(project); setDeleteConfirm(""); }} title="Delete" className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></svg></button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Last 7 days</span>
                      <span className="text-xs tabular-nums text-[var(--dim)]">{peak > 0 ? `peak ${peak}` : "no traffic"}</span>
                    </div>
                    <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1">
                      <Sparkline data={project.usage_trend ?? []} colorClass={active ? "text-emerald-500" : "text-zinc-400"} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[var(--muted)]/50 p-2.5 border border-[var(--border)]/60">
                    <div className="text-center"><p className="text-[15px] font-semibold tabular-nums text-[var(--ink)]">{project.api_key_count ?? 0}</p><p className="text-[10px] uppercase tracking-widest text-[var(--dim)]">Keys</p></div>
                    <div className="text-center border-x border-[var(--border)]"><p className="text-[15px] font-semibold tabular-nums text-[var(--ink)]">{project.screenshot_count ?? 0}</p><p className="text-[10px] uppercase tracking-widest text-[var(--dim)]">Shots</p></div>
                    <div className="text-center"><p className="text-[15px] font-semibold tabular-nums text-[var(--ink)]">{project.usage_30d ?? 0}</p><p className="text-[10px] uppercase tracking-widest text-[var(--dim)]">30d</p></div>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5 gap-2">
                  <Link href={`/dashboard/projects/${project.id}/analytics`} className="btn-primary px-3 py-1.5 text-xs h-7">Analytics →</Link>
                  <div className="flex gap-1.5">
                    <Link href={`/dashboard/history?project=${project.id}`} className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--muted)]">History</Link>
                    <Link href="/dashboard/api-keys" className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--muted)]">Keys</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative w-full max-w-[460px] rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-900">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 9v4M12 17h.01M10.3 3.3l7.4 12.8A1.5 1.5 0 0 1 16.4 18H7.6a1.5 1.5 0 0 1-1.3-2.2L13.7 3a1.5 1.5 0 0 1 2.6 0" /></svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold">Delete “{deleteTarget.name}”?</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">API keys must be removed first. This can’t be undone. Type the project name to confirm.</p>
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={deleteTarget.name} className="mt-3 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              {deleteTarget.screenshot_count ?? 0} screenshots · {deleteTarget.api_key_count ?? 0} keys · {deleteTarget.webhook_count ?? 0} webhooks will stay orphaned if you delete.
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} disabled={isPending || deleteConfirm.trim() !== deleteTarget.name.trim()} className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40">{isPending ? "Deleting…" : "Delete project"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
