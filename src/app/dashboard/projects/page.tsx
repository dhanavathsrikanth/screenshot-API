import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listProjects, type ProjectRow } from "@/app/actions/projects";
import { ProjectsManager } from "@/components/dashboard/projects-manager";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let projects: ProjectRow[] = [];
  try {
    projects = await listProjects();
  } catch {
    projects = [];
  }

  const totalKeys = projects.reduce((s, p) => s + (p.api_key_count ?? 0), 0);
  const totalUsage = projects.reduce((s, p) => s + (p.usage_30d ?? 0), 0);
  const active = projects.filter((p) => (p.usage_30d ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.07] via-transparent to-violet-500/[0.06] pointer-events-none" />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="relative p-6 sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow text-orange-600">Workspaces</p>
              <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.02em] leading-none text-[var(--ink)]">Projects</h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
                Folders for your work. Each keeps <span className="font-medium text-[var(--ink)]">API keys, screenshots & webhooks</span> isolated — use <span className="font-medium text-[var(--ink)]">Production / Staging</span> or one per client. Analytics and storage are scoped automatically.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-2.5 py-1 text-xs font-medium text-white"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {projects.length} project{projects.length !== 1 ? "s" : ""}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-xs text-[var(--dim)]">{totalKeys} keys · {totalUsage.toLocaleString()} requests 30d</span>
                {active > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900 dark:text-emerald-300">{active} active</span>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:w-[360px] shrink-0">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Projects</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{projects.length}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Active</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{active}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Keys</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{totalKeys}</p>
              </div>
              <div className="col-span-3 rounded-xl border border-[var(--border)] bg-orange-500/10 p-3 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 text-white shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">No bucket needed</p>
                  <p className="text-xs text-[var(--dim)] leading-tight">We store screenshots for you. Need S3/R2/GCS? <Link href="/dashboard/storage" className="font-medium text-[var(--ink)] underline decoration-[var(--border)] underline-offset-2">Storage →</Link></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProjectsManager initialProjects={projects} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs font-semibold">① Start with one</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">Name it “Production”. Add Staging later when you need to test without touching live keys.</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs font-semibold">② Per-client isolation</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">Agencies: one project per client keeps usage, webhooks & history separate.</p>
        </div>
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--dim)]">Need help?</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]"><Link href="/docs#projects" className="underline hover:text-[var(--ink)]">Docs</Link> · <Link href="/dashboard/api-keys" className="underline hover:text-[var(--ink)]">API Keys</Link> · <Link href="/dashboard/webhooks" className="underline hover:text-[var(--ink)]">Webhooks</Link></p>
        </div>
      </div>
    </div>
  );
}
