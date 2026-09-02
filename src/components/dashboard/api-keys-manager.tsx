"use client";

import { useState, useTransition, useCallback, useMemo, useEffect } from "react";
import {
  generateApiKey,
  revokeApiKey,
  toggleApiKey,
  updateApiKeySettings,
  rotateSigningSecret,
} from "@/app/actions/api-keys";
import type { ApiKeyEnvironment } from "@/app/actions/api-keys";
import type { ProjectRow } from "@/app/actions/projects";
import { siteConfig } from "@/lib/site";

// ── types ───────────────────────────────────────────────────────────────
type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  environment: ApiKeyEnvironment;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  rate_limit: number | null;
  expires_at: string | null;
  project_id: string | null;
  access_key: string | null;
  has_signing_secret: boolean;
};

interface Props {
  initialKeys: ApiKey[];
  projects: ProjectRow[];
}

// ── helpers ─────────────────────────────────────────────────────────────
function formatExpiry(expiresAt: string | null): { label: string; state: "ok" | "warn" | "expired" | "never" } {
  if (!expiresAt) return { label: "Never", state: "never" };
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return { label: "Never", state: "never" };
  if (d.getTime() < Date.now()) return { label: "Expired", state: "expired" };
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days <= 7) return { label: `Expires in ${days}d`, state: "warn" };
  return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), state: "ok" };
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "never";
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (value: string, id: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    setTimeout(() => setCopied(null), 1600);
  }, []);
  return { copied, copy };
}

// ── icons ───────────────────────────────────────────────────────────────
const I = {
  key: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
    </svg>
  ),
  copy: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3" />
    </svg>
  ),
  check: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  more: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  ),
  shield: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 2l7 4v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-4z" />
    </svg>
  ),
  clock: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  book: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
};

// ── reveal modal (one-time) ───────────────────────────────────────────
function RevealModal({
  creds,
  onClose,
}: {
  creds: { rawKey: string; accessKey: string; signingSecret: string };
  onClose: () => void;
}) {
  const { copied, copy } = useCopy();
  const isPlaceholder = creds.rawKey.startsWith("(");
  const envSnippet = isPlaceholder ? null : `SCREENSHOT_API_KEY=${creds.rawKey}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[560px] max-h-[90vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-[var(--border)] bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow">{I.check}</div>
              <h2 className="mt-3 text-[15px] font-semibold tracking-tight text-[var(--ink)]">
                {isPlaceholder ? "Signing secret rotated" : "API key created — copy now"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300 max-w-[44ch]">
                {isPlaceholder
                  ? "Secret API key was not changed. Your new signing secret is shown once."
                  : "This is the only time the secret is shown. Store it in your .env and never share it."}
              </p>
            </div>
            <button onClick={onClose} className="rounded-full border border-black/10 bg-white/70 p-1.5 text-zinc-600 hover:bg-white dark:bg-zinc-900 dark:text-zinc-400" aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="overflow-auto px-6 py-5 space-y-4 flex-1">
          <div className="space-y-2.5">
            {([
              ["Secret key", creds.rawKey, "sk"],
              ["Access key", creds.accessKey, "ak"],
              ["Signing secret", creds.signingSecret, "ss"],
            ] as const).map(([label, value, id]) => {
              const isSk = id === "sk" && isPlaceholder;
              return (
                <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">{label}</span>
                    <span className="text-[11px] font-mono text-[var(--dim)]">{id === "sk" ? "Bearer · server-only" : id === "ak" ? "public" : "HMAC"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className={`flex-1 min-w-0 break-all rounded-lg border bg-[var(--card)] px-3 py-2 font-mono text-[12.5px] leading-relaxed ${isSk ? "text-[var(--dim)] border-dashed" : "text-[var(--ink)] border-[var(--border)]"}`}>{value}</code>
                    {!isSk && (
                      <button onClick={() => copy(value, id)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-xs font-medium hover:bg-[var(--muted)]">
                        {copied === id ? <><span className="text-emerald-600">{I.check}</span> Copied</> : <>{I.copy} Copy</>}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {envSnippet && (
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <div className="flex items-center justify-between bg-[var(--muted)]/60 px-3 py-2 border-b border-[var(--border)]">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">.env</span>
                <button onClick={() => copy(envSnippet, "env")} className="inline-flex items-center gap-1 rounded-md bg-[var(--card)] border border-[var(--border)] px-2 py-1 text-[11px] font-medium hover:bg-[var(--muted)]">
                  {copied === "env" ? <><span className="text-emerald-600">{I.check}</span> Copied</> : <>{I.copy} Copy</>}
                </button>
              </div>
              <pre className="px-3 py-3 font-mono text-[12px] leading-6 bg-[#0a0a0a] text-zinc-100 overflow-auto">{envSnippet}</pre>
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3">
            <p className="text-xs font-medium">Use it next:</p>
            <pre className="mt-1.5 overflow-auto rounded-lg bg-[#0a0a0a] p-3 font-mono text-[12px] leading-6 text-zinc-100">{`curl -H "Authorization: Bearer ${isPlaceholder ? "sk_live_••••" : creds.rawKey.slice(0, 16) + "…"}" \\\n  "${siteConfig.apiUrl}/api/take?url=https://example.com" \\\n  --output screenshot.png`}</pre>
            <p className="mt-2 text-[11px] text-[var(--dim)]">Full examples and SDKs in the docs — no need to guess. <a href="/docs" className="underline hover:text-[var(--ink)]">Open docs →</a></p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--muted)]/40 px-6 py-4">
          <button onClick={onClose} className="btn-primary whitespace-nowrap">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── create dialog — clean, single key + expiration ────────────────────
const EXPIRY_PRESETS: { label: string; days: number | null }[] = [
  { label: "30 days", days: 30 },
  { label: "60 days", days: 60 },
  { label: "90 days", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
  { label: "Never", days: null },
];

function CreateDialog({
  open,
  onClose,
  onCreated,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (v: { rawKey: string; access_key: string; signingSecret: string; id: string; name: string; key_prefix: string; created_at: string; expires_at: string | null; project_id: string | null }) => void;
  projects: ProjectRow[];
}) {
  const [name, setName] = useState("");
  const [project, setProject] = useState("");
  const [preset, setPreset] = useState<number | null>(30);
  const [customDays, setCustomDays] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setName("");
      setProject("");
      setPreset(30);
      setCustomDays("");
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErr("Give your key a name."); return; }
    let expiresInDays: number | undefined;
    if (customDays.trim() !== "") {
      const d = Number.parseInt(customDays, 10);
      if (!Number.isFinite(d) || d <= 0) { setErr("Custom expiry must be a positive number of days."); return; }
      expiresInDays = d;
    } else {
      expiresInDays = preset ?? undefined;
    }
    setErr(null);
    start(async () => {
      try {
        const result = await generateApiKey(name.trim(), "production", project || undefined, { expiresInDays });
        onCreated({
          rawKey: result.rawKey,
          access_key: result.access_key,
          signingSecret: result.signingSecret,
          id: result.id,
          name: result.name,
          key_prefix: result.key_prefix,
          created_at: result.created_at,
          expires_at: (result.expires_at as string | null) ?? null,
          project_id: project || null,
        });
        onClose();
      } catch (e2) {
        setErr(e2 instanceof Error ? e2.message : "Failed to create key.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-[480px] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Create API key</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">Single key for all environments. Set an expiry to auto-revoke when you’re done.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[var(--dim)] hover:bg-[var(--muted)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="px-6 pb-4 space-y-4">
          <label className="block">
            <span className="text-xs font-medium">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production, My app, CI"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm placeholder:text-[var(--dim)] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              maxLength={64}
            />
          </label>

          {projects.length > 0 && (
            <label className="block">
              <span className="text-xs font-medium">Project <span className="font-normal text-[var(--dim)]">· optional</span></span>
              <select value={project} onChange={(e) => setProject(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Default project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}

          <div>
            <span className="text-xs font-medium">Expiration</span>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {EXPIRY_PRESETS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => { setPreset(o.days); setCustomDays(""); }}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium ${preset === o.days && customDays === "" ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300" : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--muted)]"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-[var(--dim)]">or custom</span>
              <input
                type="number"
                min={1}
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="days"
                className="w-28 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-xs text-[var(--dim)]">days</span>
              {customDays && <button type="button" onClick={() => setCustomDays("")} className="text-xs text-[var(--dim)] hover:text-[var(--ink)] underline">Clear</button>}
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--dim)]">Expired keys are rejected automatically. You can revoke early at any time.</p>
          </div>

          {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--muted)]/40 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={pending || !name.trim()} className="btn-primary disabled:opacity-40">{pending ? "Creating…" : "Create key"}</button>
        </div>
      </form>
    </div>
  );
}

// ── expiry editor (drawer) ────────────────────────────────────────────
function ExpiryDrawer({
  keyRow,
  projects,
  onClose,
  onSaved,
}: {
  keyRow: ApiKey;
  projects: ProjectRow[];
  onClose: () => void;
  onSaved: (patch: Partial<ApiKey>) => void;
}) {
  const [preset, setPreset] = useState<number | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [removeExpiry, setRemoveExpiry] = useState(false);
  const [project, setProject] = useState(keyRow.project_id ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () => {
    setErr(null);
    let expiresInDays: number | null | undefined;
    if (removeExpiry) expiresInDays = null;
    else if (customDays.trim() !== "") {
      const d = Number.parseInt(customDays, 10);
      if (!Number.isFinite(d) || d <= 0) { setErr("Custom expiry must be positive."); return; }
      expiresInDays = d;
    } else if (preset !== null) {
      expiresInDays = preset;
    }
    if (expiresInDays === undefined && project === (keyRow.project_id ?? "")) { onClose(); return; }
    start(async () => {
      try {
        const changedProject = project !== (keyRow.project_id ?? "");
        await updateApiKeySettings(keyRow.id, {
          ...(expiresInDays !== undefined ? { expiresInDays } : {}),
          ...(changedProject ? { projectId: project || keyRow.project_id! } : {}),
        });
        const newExpiresAt = expiresInDays === null ? null : expiresInDays && expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : keyRow.expires_at;
        // if only preset/custom changed to a new absolute, keep computed; if undefined, keep old
        onSaved({
          ...(expiresInDays !== undefined ? { expires_at: newExpiresAt } : {}),
          ...(changedProject ? { project_id: project || keyRow.project_id } : {}),
        });
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex w-full max-w-[400px] flex-col bg-[var(--card)] shadow-2xl border-l border-[var(--border)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold">Edit key</h3>
            <p className="text-xs text-[var(--dim)] font-mono">{keyRow.key_prefix}… · {keyRow.name}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[var(--muted)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div>
            <span className="text-xs font-medium">Expiration</span>
            <p className="text-[11px] text-[var(--dim)]">Current: {formatExpiry(keyRow.expires_at).label}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {EXPIRY_PRESETS.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => { setPreset(o.days); setCustomDays(""); setRemoveExpiry(false); }}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${preset === o.days && !removeExpiry && customDays === "" ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300" : "border-[var(--border)] hover:bg-[var(--muted)]"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input type="number" min={1} value={customDays} onChange={(e) => { setCustomDays(e.target.value); setRemoveExpiry(false); }} placeholder="Custom days" className="w-32 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={removeExpiry} onChange={(e) => { setRemoveExpiry(e.target.checked); if (e.target.checked) { setPreset(null); setCustomDays(""); } }} className="h-3.5 w-3.5 rounded border-[var(--border)] text-orange-600" />
                Never
              </label>
            </div>
          </div>
          {projects.length > 0 && (
            <label className="block">
              <span className="text-xs font-medium">Project</span>
              <select value={project} onChange={(e) => setProject(e.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Default</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
        </div>
        <div className="border-t border-[var(--border)] bg-[var(--muted)]/40 px-5 py-4 flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={pending} className="btn-primary disabled:opacity-40">{pending ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

// ── docs redirect card ────────────────────────────────────────────────
function DocsCard() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--card)]">{I.book}</span>
          <div>
            <h3 className="text-sm font-semibold">Developer docs</h3>
            <p className="mt-1 max-w-[56ch] text-xs leading-relaxed text-[var(--dim)]">
              Keys are simple — one key with an optional expiry. For integration details, see the docs instead of this page.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Quick start", desc: "First request in 30s — cURL, Node, Python.", href: "/docs#quickstart" },
          { title: "Authentication", desc: "Bearer header & project scoping.", href: "/docs#authentication" },
          { title: "Signed URLs", desc: "Use access_key + signature in <img> tags.", href: "/docs/signed-urls" },
          { title: "OpenAPI + SDKs", desc: "Spec, Postman and code examples.", href: "/docs/sdks" },
        ].map((c) => (
          <a key={c.href} href={c.href} className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 hover:bg-[var(--muted)]/50 hover:border-[var(--ink)]/20 transition-colors">
            <p className="text-xs font-semibold group-hover:text-orange-600">{c.title} →</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">{c.desc}</p>
          </a>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 font-mono">Authorization: Bearer sk_…</span>
        <span className="text-[var(--dim)]">kept server-side ·</span>
        <a href="/docs#errors" className="underline hover:text-[var(--ink)]">Error codes</a>
        <span className="text-[var(--border)]">·</span>
        <a href="/docs#rate-limits" className="underline hover:text-[var(--ink)]">Rate limits</a>
        <span className="text-[var(--border)]">·</span>
        <a href="/dashboard/playground" className="underline hover:text-[var(--ink)]">Playground</a>
      </div>
    </div>
  );
}

// ── main manager ──────────────────────────────────────────────────────
export function ApiKeysManager({ initialKeys, projects }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<{ rawKey: string; accessKey: string; signingSecret: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (!menuId) return;
    const h = () => setMenuId(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [menuId]);

  const now = Date.now();
  const filtered = useMemo(() => {
    return keys.filter((k) => {
      if (query && !`${k.name} ${k.key_prefix} ${k.access_key ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (statusFilter === "active" && !k.is_active) return false;
      if (statusFilter === "inactive" && k.is_active) return false;
      if (statusFilter === "expired" && !(k.expires_at && new Date(k.expires_at).getTime() < now)) return false;
      if (projectFilter !== "all" && (k.project_id ?? "") !== projectFilter) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/purity
  }, [keys, query, statusFilter, projectFilter, now]);

  const counts = useMemo(() => ({
    total: keys.length,
    active: keys.filter((k) => k.is_active).length,
    expiring: keys.filter((k) => k.expires_at && new Date(k.expires_at).getTime() - Date.now() < 7 * 86400000 && new Date(k.expires_at).getTime() > Date.now()).length,
    expired: keys.filter((k) => k.expires_at && new Date(k.expires_at).getTime() < Date.now()).length,
  }), [keys]);

  const editKey = editId ? keys.find((k) => k.id === editId) ?? null : null;

  const handleToggle = useCallback((id: string, active: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        await toggleApiKey(id, !active);
        setKeys((p) => p.map((k) => (k.id === id ? { ...k, is_active: !active } : k)));
      } catch { setError("Failed to update key."); }
    });
  }, []);

  const handleRevoke = useCallback((id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await revokeApiKey(id);
        setKeys((p) => p.filter((k) => k.id !== id));
        setRevokeId(null);
        setMenuId(null);
        if (editId === id) setEditId(null);
      } catch { setError("Failed to revoke key."); }
    });
  }, [editId]);

  const handleRotate = useCallback((id: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await rotateSigningSecret(id);
        setRevealed({ rawKey: "(unchanged — secret API key was not rotated)", accessKey: r.accessKey, signingSecret: r.signingSecret });
        setKeys((p) => p.map((k) => (k.id === id ? { ...k, access_key: r.accessKey, has_signing_secret: true } : k)));
      } catch (e) { setError(e instanceof Error ? e.message : "Could not rotate signing secret."); }
    });
  }, []);

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-xs font-medium text-red-700 underline dark:text-red-300">Dismiss</button>
        </div>
      )}

      {revealed && <RevealModal creds={revealed} onClose={() => setRevealed(null)} />}

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} projects={projects} onCreated={(created) => {
        setKeys((prev) => [{
          id: created.id, name: created.name, key_prefix: created.key_prefix, environment: "production" as const, is_active: true,
          last_used_at: null, created_at: created.created_at, rate_limit: null, expires_at: created.expires_at, project_id: created.project_id,
          access_key: created.access_key, has_signing_secret: true,
        }, ...prev]);
        setRevealed({ rawKey: created.rawKey, accessKey: created.access_key, signingSecret: created.signingSecret });
      }} />

      {editKey && <ExpiryDrawer keyRow={editKey} projects={projects} onClose={() => setEditId(null)} onSaved={(patch) => setKeys((prev) => prev.map((k) => (k.id === editKey.id ? { ...k, ...patch } : k)))} />}

      {/* top card — stats + create */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {counts.total} total
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--muted)] px-2.5 py-1 text-[var(--dim)]">{counts.active} active</span>
            {counts.expiring > 0 && <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-300">{counts.expiring} expiring soon</span>}
            {counts.expired > 0 && <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2.5 py-1 font-medium text-red-700 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300">{counts.expired} expired</span>}
          </div>
          <button onClick={() => setCreateOpen(true)} className="btn-primary shadow-sm self-start sm:self-auto">
            <span className="hidden sm:inline-flex">{I.plus}</span> Create API key
          </button>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-[320px] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dim)]">{I.search}</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or prefix…" className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="h-8 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
            {projects.length > 0 && (
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 max-w-40 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="all">All projects</option>
                <option value="">Default</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-4 py-2.5 bg-[var(--card)] text-[11px] text-[var(--dim)]">
          <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" />Keep <code className="rounded border border-[var(--border)] bg-[var(--muted)] px-1 py-0.5 font-mono text-[11px]">sk_…</code> on the server</span>
          <span className="hidden sm:inline text-[var(--border)]">·</span>
          <span>One key is enough — add an expiry to rotate cleanly. <a href="/docs#authentication" className="underline hover:text-[var(--ink)]">Learn more →</a></span>
        </div>
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div className="card p-8 sm:p-12">
          {keys.length === 0 ? (
            <div className="mx-auto max-w-[520px] text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--muted)]/50 text-[var(--dim)]">{I.key}</div>
              <h3 className="mt-4 text-sm font-semibold">No API keys yet</h3>
              <p className="mx-auto mt-1.5 max-w-[38ch] text-xs leading-relaxed text-[var(--dim)]">
                Create your first key — it takes 10 seconds. You’ll get a secret to put in <code className="font-mono">.env</code> and it’s ready to use.
              </p>
              <button onClick={() => setCreateOpen(true)} className="btn-primary mt-5">{I.plus} Create API key</button>
              <div className="mt-6 rounded-xl border border-[#222] bg-[#0a0a0a] p-3 text-left overflow-hidden">
                <span className="text-[11px] font-mono text-zinc-400">Next step after creating</span>
                <pre className="mt-2 overflow-auto font-mono text-[12px] leading-6 text-zinc-100">{`export SCREENSHOT_API_KEY="sk_live_..."\ncurl -H "Authorization: Bearer $SCREENSHOT_API_KEY" \\\n  "${siteConfig.apiUrl}/api/take?url=https://example.com" --output shot.png`}</pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-[var(--dim)]">No keys match your filters.</p>
              <button onClick={() => { setQuery(""); setStatusFilter("all"); setProjectFilter("all"); }} className="mt-3 text-xs font-medium text-orange-600 hover:underline">Clear filters</button>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1.4fr_0.9fr_0.7fr_auto] gap-3 border-b border-[var(--border)] bg-[var(--muted)]/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">
            <span>Key</span>
            <span>Project</span>
            <span>Expires</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((k) => {
              const exp = formatExpiry(k.expires_at);
              const projectName = k.project_id ? projects.find((p) => p.id === k.project_id)?.name ?? "Unknown" : "Default";
              const isExpired = exp.state === "expired";
              return (
                <div key={k.id} className={`flex flex-col gap-3 px-4 py-4 sm:grid sm:grid-cols-[1.4fr_0.9fr_0.7fr_auto] sm:items-center sm:gap-3 hover:bg-[var(--muted)]/30 transition-colors ${!k.is_active || isExpired ? "opacity-[0.92]" : ""}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{k.name}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium ${k.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-[var(--border)] bg-[var(--muted)] text-[var(--dim)]"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${k.is_active ? "bg-emerald-500" : "bg-zinc-400"}`} />{k.is_active ? "Active" : "Disabled"}
                      </span>
                      {isExpired && <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">Expired</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <code className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--muted)]/60 px-2 py-1 font-mono text-[12px]">
                        {k.key_prefix}••••••••••••
                        <button onClick={() => copy(k.key_prefix, `pfx-${k.id}`)} className="rounded p-0.5 hover:bg-[var(--card)] text-[var(--dim)] hover:text-[var(--ink)]" title="Copy prefix">{copied === `pfx-${k.id}` ? <span className="text-emerald-600">{I.check}</span> : I.copy}</button>
                      </code>
                      {k.access_key && (
                        <code className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 font-mono text-[11px] text-[var(--dim)]">
                          {k.access_key}
                          <button onClick={() => copy(k.access_key!, `ak-${k.id}`)} className="rounded p-0.5 hover:bg-[var(--muted)] text-[var(--dim)] hover:text-[var(--ink)]" title="Copy access key">{copied === `ak-${k.id}` ? <span className="text-emerald-600">{I.check}</span> : I.copy}</button>
                        </code>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--dim)]">
                      <span className="inline-flex items-center gap-1">{I.clock} last used {relativeTime(k.last_used_at)}</span>
                      <span className="text-[var(--border)]">·</span>
                      <span>created {new Date(k.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="flex sm:block items-center justify-between gap-2">
                    <span className="sm:hidden text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Project</span>
                    <span className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-xs font-medium">{projectName}</span>
                  </div>
                  <div className="flex sm:block items-center justify-between gap-2">
                    <span className="sm:hidden text-[11px] font-semibold uppercase tracking-widest text-[var(--dim)]">Expires</span>
                    <span className={`text-xs font-medium ${exp.state === "expired" ? "text-red-600 dark:text-red-400" : exp.state === "warn" ? "text-amber-600 dark:text-amber-400" : "text-[var(--ink)]"}`}>{exp.label}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5 sm:pl-2">
                    <button onClick={() => setEditId(k.id)} className="hidden sm:inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--muted)]">Edit</button>
                    <div className="relative">
                      <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === k.id ? null : k.id); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--dim)] hover:text-[var(--ink)] hover:bg-[var(--muted)]" aria-label="More">
                        {I.more}
                      </button>
                      {menuId === k.id && (
                        <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xl">
                          <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--muted)]/40">
                            <p className="text-xs font-medium truncate">{k.name}</p>
                            <p className="font-mono text-[11px] text-[var(--dim)]">{k.key_prefix}…</p>
                          </div>
                          <div className="p-1">
                            <button onClick={() => { setEditId(k.id); setMenuId(null); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-[var(--muted)]">Edit expiry / project…</button>
                            <button onClick={() => { handleRotate(k.id); setMenuId(null); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-[var(--muted)]">{k.has_signing_secret ? "Rotate signing secret" : "Enable signed URLs"}</button>
                            <button onClick={() => { handleToggle(k.id, k.is_active); setMenuId(null); }} className="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-[var(--muted)]">{k.is_active ? "Disable" : "Enable"}</button>
                            <div className="my-1 border-t border-[var(--border)]" />
                            <button onClick={() => { setRevokeId(k.id); setMenuId(null); }} className="w-full text-left rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">Revoke…</button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleToggle(k.id, k.is_active)} disabled={isPending} className={`hidden sm:inline-flex rounded-lg border px-2.5 py-1.5 text-xs font-medium ${k.is_active ? "border-[var(--border)] hover:bg-[var(--muted)]" : "border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-300"}`}>{k.is_active ? "Disable" : "Enable"}</button>
                    <button onClick={() => setRevokeId(k.id)} className="hidden sm:inline-flex rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30">Revoke</button>
                    <button onClick={() => setEditId(k.id)} className="sm:hidden inline-flex rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)]">Edit</button>
                    <button onClick={() => setRevokeId(k.id)} className="sm:hidden inline-flex rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600">Revoke</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--dim)]">
            <span>{filtered.length} of {keys.length} keys</span>
            <span className="hidden sm:inline">Expiry auto-revokes — no cron needed. <a href="/docs#authentication" className="underline hover:text-[var(--ink)]">Docs →</a></span>
          </div>
        </div>
      )}

      {revokeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRevokeId(null)} />
          <div className="relative w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-6">
            <div className="h-9 w-9 flex items-center justify-center rounded-xl bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-900">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 9v4M12 17h.01M10.3 3.3l7.4 12.8A1.5 1.5 0 0 1 16.4 18H7.6a1.5 1.5 0 0 1-1.3-2.2L13.7 3a1.5 1.5 0 0 1 2.6 0" /></svg>
            </div>
            <h3 className="mt-3 text-sm font-semibold">Revoke this key?</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--dim)]">Requests using it will fail with <code className="font-mono">401</code>. This can’t be undone.</p>
            {(() => { const k = keys.find((x) => x.id === revokeId); if (!k) return null; return (
              <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/50 px-3 py-2">
                <p className="text-xs font-medium">{k.name}</p>
                <p className="font-mono text-[11px] text-[var(--dim)]">{k.key_prefix}… · {formatExpiry(k.expires_at).label}</p>
              </div>
            ); })()}
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={() => setRevokeId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => handleRevoke(revokeId)} disabled={isPending} className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40">{isPending ? "Revoking…" : "Revoke key"}</button>
            </div>
          </div>
        </div>
      )}

      {/* docs redirect — clean, not inline guide */}
      <DocsCard />

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[var(--dim)]">
        <span>Need help? <a href="/docs#errors" className="underline hover:text-[var(--ink)]">Error codes</a> · <a href="/docs#rate-limits" className="underline hover:text-[var(--ink)]">Rate limits</a></span>
        <span className="flex items-center gap-2">
          <a href="/docs" className="underline hover:text-[var(--ink)]">Docs</a>
          <span>·</span>
          <a href="/dashboard/playground" className="underline hover:text-[var(--ink)]">Playground</a>
          <span>·</span>
          <a href="mailto:hello@screenshotapi.tech" className="underline hover:text-[var(--ink)]">Support</a>
        </span>
      </div>
    </div>
  );
}
