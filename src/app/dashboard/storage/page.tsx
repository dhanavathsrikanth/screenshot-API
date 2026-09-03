import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listProjects } from "@/app/actions/projects";
import { listUploadDestinations } from "@/app/actions/project-upload";
import { getUserPlan, isCustomerUploadAllowed } from "@/lib/plans";
import { StorageDestinationsSection } from "@/components/dashboard/storage-destinations-section";

export default async function StoragePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [projects, plan, destinations] = await Promise.all([
    listProjects().catch(() => []),
    getUserPlan(userId).catch(() => "free" as const),
    listUploadDestinations().catch(() => []),
  ]);

  const allowed = isCustomerUploadAllowed(plan);
  const healthy = destinations.filter((d) => d.last_test_ok === true).length;
  const failing = destinations.filter((d) => d.last_test_ok === false).length;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/[0.07] via-transparent to-transparent pointer-events-none" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="relative p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                Storage · S3 compatible
              </div>
              <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-[var(--ink)]">Storage</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--dim)]">
                Keep history on us. Optionally mirror every capture into <span className="font-medium text-[var(--ink)]">your own S3, R2, or GCS bucket</span> — same file, your domain, zero code changes.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z" /></svg>
                  Encrypted at rest · AES-256-GCM
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-2.5 py-1 font-medium text-[var(--dim)]">
                  Auto-redirects to your URL · stays in History as backup
                </span>
              </div>
            </div>

            <div className="flex shrink-0 gap-2.5">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 min-w-[110px]">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Buckets</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">{destinations.length}</p>
                <p className="text-[11px] text-[var(--dim)]">{healthy} healthy{ failing ? ` · ${failing} needs attention` : ""}</p>
              </div>
              <div className="hidden sm:flex flex-col justify-center rounded-xl bg-[var(--ink)] px-4 py-3 text-white min-w-[140px]">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Works with</p>
                <p className="mt-1 text-xs font-medium leading-relaxed">S3 · R2 · GCS <span className="text-white/60">(MinIO too)</span></p>
                <Link href="/docs/customer-upload" className="mt-1.5 inline-flex text-[11px] font-medium text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">Step-by-step docs →</Link>
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { k: "1. Pick your cloud", v: "S3 cheapest if on AWS — R2 has zero egress fees.", icon: "M3 7h18M3 12h18M3 17h18" },
              { k: "2. Paste 2 keys", v: "Access key + secret. We encrypt & test with a 28-byte file.", icon: "M15 7h3a2 2 0 012 2v8a2 2 0 01-2 2h-3M10 12H3m7 0l-3-3m3 3l-3 3" },
              { k: "3. Done — mirrored", v: "screenshots/<id>.png appears instantly. Your CDN URL wins.", icon: "M5 13l4 4L19 7" },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
                <div className="flex items-center gap-2 text-[var(--ink)]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--muted)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d={s.icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                  <span className="text-xs font-semibold">{s.k}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--dim)] line-clamp-2">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!allowed && (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 dark:border-amber-900 dark:from-amber-950/30 dark:to-orange-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3L3 7v6c0 5 4 8 9 10 5-2 9-5 9-10V7L12 3z" /></svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Bring-your-own bucket is Pro & Scale only</p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300 max-w-xl">You can explore the setup below — saving is disabled until you upgrade. When you do, your bucket connects instantly; past screenshots stay available and new ones mirror automatically.</p>
              </div>
            </div>
            <Link href="/dashboard/plan" className="btn-primary shrink-0">View plans — from $49/mo</Link>
          </div>
        </div>
      )}

      <StorageDestinationsSection initialDestinations={destinations} projects={projects} allowed={allowed} />

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-[var(--dim)]">Need help picking?</p>
          <div className="flex gap-2 text-xs">
            <a href="/docs/customer-upload" className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 font-medium hover:bg-[var(--muted)]">S3 guide</a>
            <a href="/docs/customer-upload" className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 font-medium hover:bg-[var(--muted)]">R2 guide</a>
            <a href="/docs/customer-upload" className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 font-medium hover:bg-[var(--muted)]">GCS HMAC guide</a>
          </div>
        </div>
      </div>
    </div>
  );
}
