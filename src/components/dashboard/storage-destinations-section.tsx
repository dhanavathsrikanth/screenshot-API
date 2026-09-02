"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  saveUploadDestination,
  deleteUploadDestination,
  testSavedUploadDestination,
  type UploadDestinationPublic,
} from "@/app/actions/project-upload";
import type { UploadProvider } from "@/lib/storage/customer-upload";
import type { ProjectRow } from "@/app/actions/projects";

/* ── helpers ─────────────────────────────────────────────────────── */

function friendlyError(raw: string): { title: string; fix: string } {
  const s = raw.toLowerCase();
  if (s.includes("nosuchbucket") || s.includes("no such bucket") || s.includes("bucket does not exist"))
    return { title: "Bucket not found", fix: "Create the bucket first (same region & name, lowercase) then retry." };
  if (s.includes("accessdenied") || s.includes("access denied") || s.includes("403"))
    return { title: "Access denied — check IAM / policy", fix: "Your key needs s3:PutObject and s3:DeleteObject on this bucket. Use the Policy generator below." };
  if (s.includes("invalidaccesskeyid") || s.includes("invalid access key"))
    return { title: "Access key ID looks wrong", fix: "Copy the Access key ID exactly — for R2 it's the S3 API token ID, not the Cloudflare email." };
  if (s.includes("signaturedoesnotmatch") || s.includes("signature"))
    return { title: "Secret key mismatch", fix: "The secret is incorrect or has extra spaces. Re-paste the Secret access key." };
  if (s.includes("r2 requires") || s.includes("public url prefix"))
    return { title: "R2 needs a public URL", fix: "Add your r2.dev subdomain or custom domain (e.g. https://pub-xyz.r2.dev). Toggle Public R2 bucket ON." };
  if (s.includes("endpoint") && s.includes("https"))
    return { title: "Endpoint must be https", fix: "Use https://<accountid>.r2.cloudflarestorage.com for R2, or https://storage.googleapis.com for GCS." };
  if (s.includes("could not resolve") || s.includes("ssrf") || s.includes("private"))
    return { title: "Endpoint not reachable", fix: "Check the endpoint URL — no localhost/private IPs and it must resolve publicly." };
  if (s.includes("bucket name is invalid"))
    return { title: "Bucket name invalid", fix: "Use 3–63 lowercase letters, numbers, dots or hyphens. No underscores, no uppercase." };
  return { title: raw.slice(0, 120), fix: "Check the fields below and use Test connection. Raw error is shown for debugging." };
}

function providerMeta(p: UploadProvider) {
  if (p === "r2") return { label: "Cloudflare R2", badge: "Cheapest", price: "No egress fees", icon: "☁️" };
  if (p === "gcs") return { label: "Google Cloud", badge: "HMAC", price: "Storage + egress", icon: "◈" };
  return { label: "Amazon S3", badge: "AWS", price: "Pay per GB", icon: "⬢" };
}

function PolicyBlock({ bucket, prefix }: { bucket: string; prefix: string }) {
  const safeBucket = bucket || "my-captures";
  const safePrefix = (prefix || "screenshots").replace(/^\/+|\/+$/g, "");
  const json = JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        { Effect: "Allow", Action: ["s3:ListBucket"], Resource: `arn:aws:s3:::${safeBucket}`, Condition: { StringLike: { "s3:prefix": [`${safePrefix}/*`] } } },
        { Effect: "Allow", Action: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], Resource: `arn:aws:s3:::${safeBucket}/${safePrefix}/*` },
      ],
    },
    null,
    2
  );
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--muted)]/60 border-b border-[var(--border)]">
        <span className="text-xs font-semibold text-[var(--ink)]">Minimal IAM policy — copy into AWS IAM → Create policy → JSON</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(json);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          }}
          className="rounded-lg bg-[var(--ink)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90"
        >
          {copied ? "Copied ✓" : "Copy JSON"}
        </button>
      </div>
      <pre className="p-3 text-[11px] leading-relaxed font-mono text-[var(--dim)] overflow-x-auto whitespace-pre">{json}</pre>
      <p className="px-3 pb-2.5 text-[11px] text-[var(--dim)]">R2/GCS: same actions — create an S3 API token / HMAC key with Object Read & Write on this bucket.</p>
    </div>
  );
}

/* ── small UI ────────────────────────────────────────────────────── */

function ProviderCard({
  active,
  onClick,
  provider,
  recommended,
}: {
  active: boolean;
  onClick: () => void;
  provider: UploadProvider;
  recommended?: boolean;
}) {
  const m = providerMeta(provider);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col text-left rounded-xl border p-3.5 transition-all ${
        active
          ? "bg-[var(--ink)] text-white border-[var(--ink)] shadow-sm"
          : "bg-[var(--card)] text-[var(--ink)] border-[var(--border)] hover:border-[var(--ink)] hover:bg-[var(--muted)]/40"
      }`}
    >
      {recommended && (
        <span className={`absolute -top-2 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${active ? "bg-white text-[var(--ink)]" : "bg-emerald-500 text-white"}`}>Recommended</span>
      )}
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${active ? "bg-white/15" : "bg-[var(--muted)]"}`}>{m.icon}</span>
        {m.label}
      </span>
      <span className={`mt-1.5 text-xs leading-relaxed ${active ? "text-white/75" : "text-[var(--dim)]"}`}>{m.price} · {m.badge}</span>
      <span className={`mt-2 inline-flex text-[11px] font-medium ${active ? "text-white" : "text-[var(--dim)] group-hover:text-[var(--ink)]"}`}>{active ? "✓ Selected" : "Select →"}</span>
    </button>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Cloud", "Bucket", "Keys", "Review"];
  return (
    <div className="flex items-center gap-1.5">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <div key={l} className="flex items-center gap-1.5">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border ${done ? "bg-emerald-500 border-emerald-500 text-white" : active ? "bg-[var(--ink)] border-[var(--ink)] text-white" : "bg-[var(--muted)] border-[var(--border)] text-[var(--dim)]"}`}>
              {done ? "✓" : n}
            </div>
            <span className={`hidden sm:inline text-xs font-medium ${active ? "text-[var(--ink)]" : "text-[var(--dim)]"}`}>{l}</span>
            {i < labels.length - 1 && <span className={`mx-1 h-px w-4 sm:w-8 ${n < step ? "bg-emerald-500" : "bg-[var(--border)]"}`} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── main ────────────────────────────────────────────────────────── */

export function StorageDestinationsSection({
  initialDestinations,
  projects,
  allowed,
}: {
  initialDestinations: UploadDestinationPublic[];
  projects: ProjectRow[];
  allowed: boolean;
}) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState(1);
  const [editingProjectId, setEditingProjectId] = useState<string>("");
  const [provider, setProvider] = useState<UploadProvider>("r2");
  const [bucket, setBucket] = useState("");
  const [region, setRegion] = useState("auto");
  const [endpoint, setEndpoint] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [pathPrefix, setPathPrefix] = useState("screenshots");
  const [useCustomEndpoint, setUseCustomEndpoint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [testingId, setTestingId] = useState<string | null>(null);

  const editingDest = useMemo(() => destinations.find((d) => d.project_id === editingProjectId) ?? null, [destinations, editingProjectId]);
  const isEditing = !!editingDest && destinations.some((d) => d.project_id === editingProjectId) && showForm && bucket === editingDest.bucket;

  const previewUrl = useMemo(() => {
    const pre = publicUrl?.replace(/\/$/, "") || (provider === "s3" ? `https://${bucket || "my-bucket"}.s3.amazonaws.com` : provider === "gcs" ? `https://storage.googleapis.com/${bucket || "my-bucket"}` : `https://pub-xxxxx.r2.dev`);
    const prefix = (pathPrefix || "screenshots").replace(/^\/+|\/+$/g, "");
    return `${pre}/${prefix}/abc123.png`;
  }, [publicUrl, provider, bucket, pathPrefix]);

  useEffect(() => {
    if (provider === "r2") { setRegion("auto"); if (!endpoint) setEndpoint(""); }
    else if (provider === "gcs") { setRegion("auto"); setEndpoint("https://storage.googleapis.com"); }
    else { if (region === "auto") setRegion("us-east-1"); }
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setEditingProjectId(projects[0]?.id ?? "");
    setProvider("r2");
    setBucket("");
    setRegion("auto");
    setEndpoint("");
    setAccessKeyId("");
    setSecret("");
    setShowSecret(false);
    setPublicUrl("");
    setPathPrefix("screenshots");
    setUseCustomEndpoint(false);
    setError(null);
    setOk(null);
    setFieldErrors({});
    setStep(1);
  }

  function openAdd() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(dest: UploadDestinationPublic) {
    setEditingProjectId(dest.project_id);
    setProvider(dest.provider);
    setBucket(dest.bucket);
    setRegion(dest.region);
    setEndpoint(dest.endpoint ?? "");
    setUseCustomEndpoint(!!dest.endpoint && dest.provider === "s3");
    setAccessKeyId(dest.access_key_id);
    setSecret("");
    setShowSecret(false);
    setPublicUrl(dest.public_url_prefix ?? "");
    setPathPrefix(dest.path_prefix);
    setError(null);
    setOk(null);
    setFieldErrors({});
    setStep(1);
    setShowForm(true);
  }

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 1 && !projects.find((p) => p.id === editingProjectId)) errs.project = "Pick a project.";
    if (s === 2) {
      if (!bucket.trim()) errs.bucket = "Bucket name required.";
      else if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket.trim().toLowerCase())) errs.bucket = "3–63 chars: lowercase, numbers, . or -. Eg my-captures";
      if (provider === "s3" && !region.trim()) errs.region = "Region required (us-east-1).";
      if (provider === "r2" && !endpoint.trim()) errs.endpoint = "Paste S3 API endpoint from R2 → API → S3 endpoint.";
      if (provider === "r2" && endpoint && !endpoint.startsWith("https://")) errs.endpoint = "Must start with https://";
    }
    if (s === 3) {
      if (!accessKeyId.trim()) errs.accessKeyId = "Access key ID required.";
      const needsSecret = !destinations.find((d) => d.project_id === editingProjectId);
      if (!secret.trim() && needsSecret) errs.secret = "Secret access key required.";
      if (provider === "r2" && !publicUrl.trim()) errs.publicUrl = "Public URL required for R2 (r2.dev or custom domain).";
      if (publicUrl && !publicUrl.startsWith("https://")) errs.publicUrl = "Must be https://";
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      const first = Object.values(errs)[0];
      setError(first);
      return false;
    }
    setError(null);
    return true;
  }

  if (!allowed) {
    return (
      <div className="card p-0 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--ink)]">Bring your own bucket — S3, R2 or GCS</h3>
              <p className="mt-1 text-sm leading-relaxed text-[var(--dim)]">Every capture is copied into your bucket. Our history stays as backup. Requires <span className="font-medium text-[var(--ink)]">Pro or Scale</span>.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/dashboard/plan" className="btn-primary">View plans</Link>
                <Link href="/docs/customer-upload" className="btn-secondary">How it works</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--muted)]/40 px-6 py-3 flex items-center justify-between text-xs">
          <span className="text-[var(--dim)]">Free plan keeps using our encrypted storage — upgrade when ready.</span>
          <span className="hidden sm:inline font-mono text-[var(--dim)]">screenshots/ → your bucket</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">Connected buckets</h3>
          <p className="text-xs text-[var(--dim)] mt-1">
            {destinations.length === 0 ? "No bucket yet — connect one in ~60 seconds." : `${destinations.length} destination${destinations.length !== 1 ? "s" : ""} · New captures mirror automatically`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {destinations.length > 0 && <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300">{destinations.filter((d)=>d.last_test_ok===true).length} healthy</span>}
          <button onClick={openAdd} className="btn-primary text-sm">+ Add bucket</button>
        </div>
      </div>

      {destinations.length === 0 && !showForm ? (
        <div className="card border-dashed p-8 sm:p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 17l6-6 4 4 6-6" /><path d="M4 17V7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--ink)]">No bucket connected</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--dim)] max-w-md mx-auto">One bucket per project. New screenshots are copied there at <span className="font-mono text-xs bg-[var(--muted)] px-1 py-0.5 rounded">screenshots/…</span> and we keep History as backup.</p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={openAdd} className="btn-primary">Connect bucket — 1 min</button>
            <Link href="/docs/customer-upload" className="btn-secondary">See example URLs</Link>
          </div>
          <p className="mt-3 text-[11px] text-[var(--dim)]">Works with S3, R2, GCS (HMAC) and any S3-compatible store.</p>
        </div>
      ) : null}

      {destinations.length > 0 && (
        <div className="grid gap-3">
          {destinations.map((d) => {
            const proj = projects.find((p) => p.id === d.project_id);
            const meta = providerMeta(d.provider);
            const isTesting = testingId === d.project_id;
            return (
              <div key={d.project_id} className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5 hover:border-[var(--card-hover-border)] hover:shadow-sm transition-all">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--muted)] text-sm">{meta.icon}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--ink)]">{proj?.name ?? d.project_id.slice(0, 8)} <span className="font-normal text-[var(--dim)]">· {d.bucket}</span></p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="inline-flex rounded-full bg-[var(--muted)] px-2 py-0.5 font-medium uppercase tracking-wide text-[var(--dim)]">{d.provider}</span>
                        <span className="font-mono text-[var(--dim)]">{d.path_prefix}/ · {d.region}</span>
                        {d.public_url_prefix && <span className="hidden sm:inline truncate max-w-[220px] font-mono text-[var(--dim)]">→ {d.public_url_prefix}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {d.last_test_ok === true && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Healthy · {d.last_tested_at ? new Date(d.last_tested_at).toLocaleDateString() : "tested"}</span>}
                    {d.last_test_ok === false && <span title={d.last_test_error ?? ""} className="inline-flex max-w-[260px] truncate rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-300">● Failed: {d.last_test_error?.slice(0, 56)}</span>}
                    {d.last_test_ok === null && <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">Not tested yet</span>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button onClick={() => openEdit(d)} className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]">Edit</button>
                  <button
                    disabled={isTesting}
                    onClick={() => {
                      setTestingId(d.project_id);
                      setError(null);
                      startTransition(async () => {
                        try {
                          await testSavedUploadDestination(d.project_id);
                          setDestinations((prev) => prev.map((x) => (x.project_id === d.project_id ? { ...x, last_test_ok: true, last_test_error: null, last_tested_at: new Date().toISOString() } : x)));
                          setOk("Connection healthy ✓");
                          setTimeout(()=>setOk(null), 2500);
                        } catch (e) {
                          const msg = e instanceof Error ? e.message : String(e);
                          const f = friendlyError(msg);
                          setError(`${f.title}: ${f.fix} (${msg.slice(0,120)})`);
                          setDestinations((prev) => prev.map((x) => (x.project_id === d.project_id ? { ...x, last_test_ok: false, last_test_error: msg } : x)));
                        } finally { setTestingId(null); }
                      });
                    }}
                    className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {isTesting ? "Testing…" : "Test connection"}
                  </button>
                  <button
                    onClick={() => {
                      if (!confirm(`Remove bucket ${d.bucket}? New captures will stay only in History.`)) return;
                      startTransition(async () => {
                        await deleteUploadDestination(d.project_id);
                        setDestinations((prev) => prev.filter((x) => x.project_id !== d.project_id));
                      });
                    }}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  >
                    Remove
                  </button>
                  <span className="ml-auto hidden sm:inline-flex items-center text-[11px] text-[var(--dim)] font-mono truncate max-w-[280px]">{d.bucket}/{d.path_prefix}/…</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Wizard form */}
      {showForm && (
        <div className="card overflow-hidden animate-fade-in">
          <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-[var(--ink)]">{editingDest ? "Edit bucket" : "Connect a bucket"}</h4>
                <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">Encrypted at rest (AES-256-GCM). We test with a 28-byte write + delete — no data kept.</p>
                <div className="mt-3"><Stepper step={step} /></div>
              </div>
              <button onClick={() => setShowForm(false)} className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-[var(--dim)] hover:bg-[var(--muted)]">✕</button>
            </div>
          </div>

          <form
            className="p-5 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 4) {
                if (!validateStep(step)) return;
                setStep((s) => Math.min(4, s + 1));
                return;
              }
              if (!validateStep(2) || !validateStep(3)) { setStep(2); return; }
              setError(null); setOk(null);
              startTransition(async () => {
                try {
                  const saved = await saveUploadDestination({
                    projectId: editingProjectId,
                    provider,
                    bucket,
                    region,
                    endpoint: endpoint || undefined,
                    accessKeyId,
                    secretAccessKey: secret,
                    publicUrlPrefix: publicUrl || undefined,
                    pathPrefix,
                  });
                  setDestinations((prev) => {
                    const without = prev.filter((x) => x.project_id !== saved.project_id);
                    return [...without, saved];
                  });
                  setOk(secret ? "Saved and tested — mirroring is live ✓" : "Saved. Re-enter secret to re-test.");
                  setSecret("");
                  setShowForm(false);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Save failed.";
                  const f = friendlyError(msg);
                  setError(`${f.title}. ${f.fix}`);
                  setFieldErrors((prev) => ({ ...prev, _server: msg }));
                }
              });
            }}
          >
            {/* Step 1: Project + Provider */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="text-xs font-semibold text-[var(--ink)]">Project</label>
                  <p className="text-[11px] text-[var(--dim)]">One bucket per project — choose where to mirror.</p>
                  <select value={editingProjectId} onChange={(e) => setEditingProjectId(e.target.value)} className={`mt-1.5 w-full rounded-xl border bg-[var(--background)] px-3 py-2.5 text-sm ${fieldErrors.project ? "border-red-300 bg-red-50/50" : "border-[var(--border)]"}`}>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    {projects.length === 0 && <option value="">No projects — create one in Projects first</option>}
                  </select>
                  {fieldErrors.project && <p className="mt-1 text-xs text-red-600">{fieldErrors.project}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--ink)]">Where should we copy your screenshots?</label>
                  <p className="mt-0.5 text-xs text-[var(--dim)]">Pick the cloud you already use. R2 is cheapest (no egress fees) and recommended.</p>
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
                    <ProviderCard active={provider === "r2"} onClick={() => setProvider("r2")} provider="r2" recommended />
                    <ProviderCard active={provider === "s3"} onClick={() => setProvider("s3")} provider="s3" />
                    <ProviderCard active={provider === "gcs"} onClick={() => setProvider("gcs")} provider="gcs" />
                  </div>
                  <div className="mt-2.5 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2.5 flex gap-2.5">
                    <span className="text-[11px] leading-relaxed text-[var(--dim)]">
                      {provider === "r2" && <>R2: Cloudflare Dashboard → <span className="font-medium text-[var(--ink)]">R2 → Manage R2 API Tokens → Create API token</span> (Object Read & Write). Copy the S3 endpoint + token.</>}
                      {provider === "s3" && <>S3: IAM → Users → Security credentials → <span className="font-medium text-[var(--ink)]">Create access key</span>. Or use the policy generator in Step 3.</>}
                      {provider === "gcs" && <>GCS: Cloud Console → Storage → Settings → <span className="font-medium text-[var(--ink)]">Interoperability → Service account HMAC keys → Create</span>. Endpoint is fixed.</>}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Bucket + Region/Endpoint */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--ink)]">Bucket name <span className="text-red-500">*</span></span>
                    <input
                      value={bucket}
                      onChange={(e) => setBucket(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, "-"))}
                      placeholder="my-captures"
                      className={`w-full rounded-xl border bg-[var(--background)] px-3 py-2.5 text-sm font-mono ${fieldErrors.bucket ? "border-red-300 bg-red-50/50" : "border-[var(--border)]"}`}
                      required
                    />
                    {fieldErrors.bucket ? <span className="text-xs text-red-600">{fieldErrors.bucket}</span> : <span className="text-[11px] text-[var(--dim)]">Lowercase, 3–63 chars. Must already exist.</span>}
                  </label>
                  {provider === "s3" ? (
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-[var(--ink)]">Region</span>
                      <select value={region} onChange={(e) => setRegion(e.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm">
                        {["us-east-1","us-west-2","eu-west-1","eu-central-1","ap-southeast-1","ap-northeast-1","auto"].map(r=> <option key={r} value={r}>{r}</option>)}
                      </select>
                      <span className="text-[11px] text-[var(--dim)]">Match bucket region. us-east-1 is default.</span>
                    </label>
                  ) : (
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-[var(--ink)]">Region</span>
                      <input value="auto" disabled className="w-full rounded-xl border border-[var(--border)] bg-[var(--muted)] px-3 py-2.5 text-sm text-[var(--dim)]" />
                      <span className="text-[11px] text-[var(--dim)]">Auto for {provider === "r2" ? "R2" : "GCS"}.</span>
                    </label>
                  )}
                </div>

                {(provider === "r2" || provider === "gcs") && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--ink)]">Endpoint {provider === "r2" && <span className="text-red-500">*</span>}</span>
                    <input
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder={provider === "r2" ? "https://<accountid>.r2.cloudflarestorage.com" : "https://storage.googleapis.com"}
                      className={`w-full rounded-xl border bg-[var(--background)] px-3 py-2.5 text-sm font-mono ${fieldErrors.endpoint ? "border-red-300 bg-red-50/50" : "border-[var(--border)]"}`}
                    />
                    {fieldErrors.endpoint ? <span className="text-xs text-red-600">{fieldErrors.endpoint}</span> : <span className="text-[11px] text-[var(--dim)]">{provider === "r2" ? "Cloudflare → R2 → Manage R2 API Tokens → S3 API endpoint (https://…). Copy exactly." : "Fixed: https://storage.googleapis.com"}</span>}
                  </label>
                )}
                {provider === "s3" && (
                  <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5">
                    <input type="checkbox" checked={useCustomEndpoint} onChange={(e)=>setUseCustomEndpoint(e.target.checked)} className="rounded" />
                    <span className="text-xs font-medium text-[var(--ink)]">Use custom S3-compatible endpoint (MinIO, etc.)</span>
                  </label>
                )}
                {provider === "s3" && useCustomEndpoint && (
                  <label className="block space-y-1.5 animate-fade-in">
                    <span className="text-xs font-semibold text-[var(--ink)]">Custom endpoint</span>
                    <input value={endpoint} onChange={(e)=>setEndpoint(e.target.value)} placeholder="https://s3.example.com" className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm font-mono" />
                    <span className="text-[11px] text-[var(--dim)]">Must be https:// and publicly resolvable.</span>
                  </label>
                )}

                <div className="rounded-xl bg-[var(--muted)]/40 border border-[var(--border)] px-3 py-2.5">
                  <p className="text-xs font-medium text-[var(--ink)]">Preview</p>
                  <p className="mt-1 font-mono text-xs text-[var(--dim)] break-all">{bucket || "my-captures"}/{pathPrefix}/<span className="text-[var(--ink)]">2026-03-14-abc.png</span></p>
                </div>
              </div>
            )}

            {/* Step 3: Keys + Public URL */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--ink)]">Access key ID <span className="text-red-500">*</span></span>
                    <input value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value.trim())} placeholder={provider==="gcs" ? "GOOG… (HMAC)" : "AKIA… or R2 token ID"} className={`w-full rounded-xl border bg-[var(--background)] px-3 py-2.5 text-sm font-mono ${fieldErrors.accessKeyId ? "border-red-300" : "border-[var(--border)]"}`} autoComplete="off" required />
                    {fieldErrors.accessKeyId && <span className="text-xs text-red-600">{fieldErrors.accessKeyId}</span>}
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--ink)]">Secret access key {destinations.find((d)=>d.project_id===editingProjectId) ? <span className="font-normal text-[var(--dim)]">(leave blank to keep)</span> : <span className="text-red-500">*</span>}</span>
                    <div className="relative">
                      <input type={showSecret ? "text" : "password"} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={destinations.find((d)=>d.project_id===editingProjectId) ? "•••••••• (unchanged)" : "••••••••"} className={`w-full rounded-xl border bg-[var(--background)] px-3 py-2.5 pr-16 text-sm font-mono ${fieldErrors.secret ? "border-red-300" : "border-[var(--border)]"}`} autoComplete="new-password" />
                      <button type="button" onClick={()=>setShowSecret(v=>!v)} className="absolute right-1 top-1 bottom-1 rounded-lg px-2.5 text-xs font-medium text-[var(--dim)] hover:bg-[var(--muted)]">{showSecret ? "Hide" : "Show"}</button>
                    </div>
                    {fieldErrors.secret && <span className="text-xs text-red-600">{fieldErrors.secret}</span>}
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[var(--ink)]">Public URL prefix {provider === "r2" && <span className="text-red-500">*</span>} <span className="font-normal text-[var(--dim)]">— where your CDN serves the file</span></span>
                  <input value={publicUrl} onChange={(e) => setPublicUrl(e.target.value)} placeholder={provider==="r2" ? "https://pub-xxxx.r2.dev or https://cdn.example.com" : "https://cdn.example.com (optional for S3)"} className={`w-full rounded-xl border bg-[var(--background)] px-3 py-2.5 text-sm font-mono ${fieldErrors.publicUrl ? "border-red-300" : "border-[var(--border)]"}`} />
                  {fieldErrors.publicUrl ? <span className="text-xs text-red-600">{fieldErrors.publicUrl}</span> : <span className="text-[11px] text-[var(--dim)]">{provider==="r2" ? "R2: enable Public access (r2.dev) or add a custom domain, then paste it here." : "S3: leave empty to use https://{bucket}.s3.amazonaws.com — or paste your CloudFront/custom domain."}</span>}
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-[var(--ink)]">Path prefix</span>
                  <input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value.replace(/[^a-zA-Z0-9/_-]/g, ""))} placeholder="screenshots" className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm font-mono" />
                  <span className="text-[11px] text-[var(--dim)]">We store at <span className="font-mono">{pathPrefix || "screenshots"}/&lt;key&gt;</span>. Keep it simple — no leading slash.</span>
                </label>

                <details className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30">
                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-[var(--ink)]">Need a locked-down IAM policy? (S3)</summary>
                  <div className="p-3 pt-0">
                    <div className="mt-2"><PolicyBlock bucket={bucket} prefix={pathPrefix} /></div>
                  </div>
                </details>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Delivery URL preview</p>
                  <p className="mt-1 font-mono text-xs break-all text-[var(--ink)]">{previewUrl}</p>
                  <p className="mt-1 text-[11px] text-[var(--dim)]">JSON responses return this as <span className="font-mono">url</span> and <span className="font-mono">upload_url</span>. Our storage stays as fallback.</p>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-4 animate-fade-in">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
                  <h5 className="text-xs font-semibold uppercase tracking-widest text-[var(--dim)]">Review</h5>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-[var(--dim)]">Project</dt><dd className="font-medium text-[var(--ink)] truncate">{projects.find(p=>p.id===editingProjectId)?.name ?? editingProjectId}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[var(--dim)]">Provider</dt><dd className="font-medium text-[var(--ink)]">{providerMeta(provider).label}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[var(--dim)]">Bucket</dt><dd className="font-mono text-[var(--ink)]">{bucket || "—"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[var(--dim)]">Region / Endpoint</dt><dd className="font-mono text-xs text-[var(--ink)] truncate max-w-[200px]">{provider==="s3" ? region : endpoint || "auto"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[var(--dim)]">Public prefix</dt><dd className="font-mono text-xs text-[var(--ink)] truncate max-w-[200px]">{publicUrl || "(auto S3 URL)"}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[var(--dim)]">Path</dt><dd className="font-mono text-[var(--ink)]">{pathPrefix}/</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[var(--dim)]">Key ID</dt><dd className="font-mono text-xs text-[var(--ink)]">{accessKeyId ? `${accessKeyId.slice(0,4)}…${accessKeyId.slice(-4)}` : "—"}</dd></div>
                  </dl>
                  <p className="mt-3 rounded-lg bg-[var(--muted)] px-3 py-2 font-mono text-xs break-all text-[var(--dim)]">{previewUrl}</p>
                </div>
                <label className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <input type="checkbox" defaultChecked className="mt-0.5" />
                  <span className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-200"><span className="font-semibold">Test before saving</span> — we PUT a 28-byte file then DELETE it. The capture never fails if your bucket is temporarily down; we keep our copy.</span>
                </label>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">Couldn&apos;t save</p>
                <p className="mt-1 text-xs leading-relaxed text-red-600 dark:text-red-400">{error}</p>
                {fieldErrors._server && <p className="mt-1 font-mono text-[11px] break-all text-red-500/80">{fieldErrors._server}</p>}
              </div>
            )}
            {ok && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20">{ok}</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {step > 1 && <button type="button" onClick={() => { setError(null); setStep((s)=> s-1); }} className="btn-secondary">Back</button>}
              {step < 4 ? (
                <button type="submit" className="btn-primary ml-auto">Continue →</button>
              ) : (
                <>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary ml-auto">Cancel</button>
                  <button type="submit" disabled={isPending || !editingProjectId} className="btn-primary disabled:opacity-50 min-w-[150px]">
                    {isPending ? "Testing & saving…" : editingDest ? "Save and re-test" : "Save and test →"}
                  </button>
                </>
              )}
              {step < 4 && <button type="button" onClick={()=>setShowForm(false)} className="rounded-lg px-3 py-2 text-xs font-medium text-[var(--dim)] hover:bg-[var(--muted)]">Cancel</button>}
            </div>

            <p className="text-center text-[11px] text-[var(--dim)]">Secrets are encrypted at rest (AES-256-GCM) and never returned. <Link href="/docs/customer-upload" className="font-medium text-[var(--ink)] underline decoration-[var(--border)] underline-offset-2">Docs →</Link></p>
          </form>
        </div>
      )}
      {error && !showForm && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:bg-red-950/20 dark:text-red-300">{error}</div>
      )}
      {ok && !showForm && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{ok}</p>}
    </div>
  );
}
