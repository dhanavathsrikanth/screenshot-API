"use client";

import { useState, useTransition, useCallback } from "react";
import {
  generateApiKey,
  revokeApiKey,
  toggleApiKey,
  updateApiKeySettings,
  rotateSigningSecret,
} from "@/app/actions/api-keys";
import type { ApiKeyEnvironment } from "@/app/actions/api-keys";
import type { ProjectRow } from "@/app/actions/projects";

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

interface ApiKeysManagerProps {
  initialKeys: ApiKey[];
  projects: ProjectRow[];
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Never";
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return "Never";
  if (d.getTime() < Date.now()) return "Expired";
  return d.toLocaleDateString();
}

function KeySettingsEditor({
  keyId,
  rateLimit,
  expiresAt,
  projectId,
  projects,
  onSaved,
  onCancel,
}: {
  keyId: string;
  rateLimit: number | null;
  expiresAt: string | null;
  projectId: string | null;
  projects: ProjectRow[];
  onSaved: (patch: {
    rate_limit: number | null;
    expires_at: string | null;
    project_id?: string | null;
  }) => void;
  onCancel: () => void;
}) {
  const [rateLimitInput, setRateLimitInput] = useState(rateLimit?.toString() ?? "");
  const [expiresDaysInput, setExpiresDaysInput] = useState("");
  const [clearExpiry, setClearExpiry] = useState(false);
  const [selectedProject, setSelectedProject] = useState(projectId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    const parsedRate =
      rateLimitInput.trim() === "" ? null : Number.parseInt(rateLimitInput, 10);
    if (rateLimitInput.trim() !== "" && (!Number.isFinite(parsedRate) || parsedRate! <= 0)) {
      setError("Rate limit must be a positive number, or leave blank for plan default.");
      return;
    }
    let expiresInDays: number | null | undefined;
    if (clearExpiry) {
      expiresInDays = null;
    } else if (expiresDaysInput.trim() !== "") {
      const days = Number.parseInt(expiresDaysInput, 10);
      if (!Number.isFinite(days) || days <= 0) {
        setError("Expiry must be a positive number of days, or leave blank to keep unchanged.");
        return;
      }
      expiresInDays = days;
    }

    startTransition(async () => {
      try {
        const projectChanged = selectedProject && selectedProject !== (projectId ?? "");
        await updateApiKeySettings(keyId, {
          rateLimitPerMinute: parsedRate,
          ...(expiresInDays !== undefined ? { expiresInDays } : {}),
          ...(projectChanged ? { projectId: selectedProject } : {}),
        });
        const newExpiresAt =
          expiresInDays === null
            ? null
            : expiresInDays && expiresInDays > 0
              ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
              : expiresAt;
        onSaved({
          rate_limit: parsedRate,
          expires_at: newExpiresAt,
          ...(projectChanged ? { project_id: selectedProject } : {}),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save settings.");
      }
    });
  };

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs text-[var(--dim)]">
          Rate limit (req/min)
          <input
            type="number"
            min={1}
            value={rateLimitInput}
            onChange={(e) => setRateLimitInput(e.target.value)}
            placeholder="Plan default"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </label>
        <label className="block text-xs text-[var(--dim)]">
          Expires in (days)
          <input
            type="number"
            min={1}
            value={expiresDaysInput}
            onChange={(e) => setExpiresDaysInput(e.target.value)}
            placeholder={expiresAt ? `Current: ${formatExpiry(expiresAt)}` : "No expiry"}
            disabled={clearExpiry}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
          />
        </label>
      </div>
      {projects.length > 0 && (
        <label className="block text-xs text-[var(--dim)]">
          Project
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-2 text-xs text-[var(--dim)] cursor-pointer">
        <input
          type="checkbox"
          checked={clearExpiry}
          onChange={(e) => setClearExpiry(e.target.checked)}
          className="rounded border-[var(--border)] text-orange-600 focus:ring-orange-500"
        />
        Remove expiry (key never expires)
      </label>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-xs py-1.5 px-3">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ApiKeysManager({ initialKeys, projects }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<ApiKeyEnvironment>("production");
  const [newKeyProject, setNewKeyProject] = useState<string>("");
  const [newRateLimit, setNewRateLimit] = useState("");
  const [newExpiresDays, setNewExpiresDays] = useState("");
  const [createdCreds, setCreatedCreds] = useState<{
    rawKey: string;
    accessKey: string;
    signingSecret: string;
  } | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [editKeyId, setEditKeyId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setError(null);

    const rateLimitPerMinute =
      newRateLimit.trim() === "" ? undefined : Number.parseInt(newRateLimit, 10);
    if (newRateLimit.trim() !== "" && (!Number.isFinite(rateLimitPerMinute) || rateLimitPerMinute! <= 0)) {
      setError("Rate limit must be a positive number.");
      return;
    }
    const expiresInDays =
      newExpiresDays.trim() === "" ? undefined : Number.parseInt(newExpiresDays, 10);
    if (newExpiresDays.trim() !== "" && (!Number.isFinite(expiresInDays) || expiresInDays! <= 0)) {
      setError("Expiry must be a positive number of days.");
      return;
    }

    try {
      const result = await generateApiKey(
        newKeyName.trim(),
        newKeyEnv,
        newKeyProject || undefined,
        {
          rateLimitPerMinute,
          expiresInDays,
        }
      );
      setCreatedCreds({
        rawKey: result.rawKey,
        accessKey: result.access_key,
        signingSecret: result.signingSecret,
      });
      setKeys((prev) => [
        {
          id: result.id,
          name: result.name,
          key_prefix: result.key_prefix,
          environment: newKeyEnv,
          is_active: true,
          last_used_at: null,
          created_at: result.created_at,
          rate_limit: result.rate_limit ?? null,
          expires_at: result.expires_at ?? null,
          project_id: newKeyProject || null,
          access_key: result.access_key,
          has_signing_secret: true,
        },
        ...prev,
      ]);
      setNewKeyName("");
      setNewRateLimit("");
      setNewExpiresDays("");
      setShowCreateForm(false);
    } catch {
      setError("Failed to create API key. Please try again.");
    }
  }, [newKeyName, newKeyEnv, newKeyProject, newRateLimit, newExpiresDays]);

  const handleToggle = useCallback(async (keyId: string, currentActive: boolean) => {
    setError(null);
    startTransition(async () => {
      try {
        await toggleApiKey(keyId, !currentActive);
        setKeys((prev) =>
          prev.map((k) => (k.id === keyId ? { ...k, is_active: !currentActive } : k))
        );
      } catch {
        setError("Failed to update key. Please try again.");
      }
    });
  }, []);

  const handleRevoke = useCallback(async (keyId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await revokeApiKey(keyId);
        setKeys((prev) => prev.filter((k) => k.id !== keyId));
        setRevokeConfirmId(null);
        if (editKeyId === keyId) setEditKeyId(null);
      } catch {
        setError("Failed to revoke key. Please try again.");
      }
    });
  }, [editKeyId]);

  const copyKey = useCallback(async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }, []);

  return (
    <div>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {createdCreds && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 mb-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
            API key created successfully
          </p>
          <p className="text-xs text-green-700 dark:text-green-400 mb-3">
            Copy the secret key and signing secret now. They will not be shown again.
          </p>
          {(
            [
              ["Secret key", createdCreds.rawKey],
              ["Access key (public)", createdCreds.accessKey],
              ["Signing secret", createdCreds.signingSecret],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="mb-2">
              <p className="text-[11px] font-medium text-green-800 dark:text-green-300 mb-1">{label}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-green-100 dark:bg-green-900/50 rounded px-3 py-2 font-mono break-all text-green-800 dark:text-green-300">
                  {value}
                </code>
                <button
                  type="button"
                  onClick={() => copyKey(value)}
                  className="flex-shrink-0 rounded-lg border border-green-300 dark:border-green-700 px-3 py-2 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                >
                  {copiedKey ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => setCreatedCreds(null)}
            className="mt-2 text-xs text-green-600 dark:text-green-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--dim)]">
          {keys.length} key{keys.length !== 1 ? "s" : ""}
        </p>
        {!showCreateForm && (
          <button onClick={() => setShowCreateForm(true)} className="btn-primary">
            Create Key
          </button>
        )}
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="space-y-3 mb-4">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. production, staging)"
              className="flex-1 min-w-[200px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoFocus
            />
            <select
              value={newKeyEnv}
              onChange={(e) => setNewKeyEnv(e.target.value as ApiKeyEnvironment)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="production">Live</option>
              <option value="test">Test</option>
            </select>
            {projects.length > 1 && (
              <select
                value={newKeyProject}
                onChange={(e) => setNewKeyProject(e.target.value)}
                className="max-w-48 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">Default project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              type="number"
              min={1}
              value={newRateLimit}
              onChange={(e) => setNewRateLimit(e.target.value)}
              placeholder="Rate limit (req/min, optional)"
              className="w-52 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="number"
              min={1}
              value={newExpiresDays}
              onChange={(e) => setNewExpiresDays(e.target.value)}
              placeholder="Expires in days (optional)"
              className="w-52 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending || !newKeyName.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewKeyName("");
                setNewRateLimit("");
                setNewExpiresDays("");
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
          <div className="text-[var(--dim)] mb-3">
            <svg className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
          </div>
          <p className="text-sm text-[var(--dim)] mb-1">No API keys yet</p>
          <p className="text-xs text-[var(--dim)]">Create a key to start using the API programmatically.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="rounded-xl border border-[var(--border)] p-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">{key.name}</p>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        key.environment === "test"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
                      }`}
                    >
                      {key.environment === "test" ? "Test" : "Live"}
                    </span>
                    <span
                      className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
                        key.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-[var(--muted)] text-[var(--dim)]"
                      }`}
                    >
                      {key.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--dim)] mt-0.5 font-mono">
                    {key.key_prefix}...
                    {key.access_key ? (
                      <span className="ml-2 font-mono">access_key {key.access_key}</span>
                    ) : null}
                    <span className="text-[var(--dim)] ml-2 font-sans">
                      Last used {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "never"}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--dim)] mt-1">
                    Project:{" "}
                    <span className="font-medium text-[var(--ink)]">
                      {key.project_id
                        ? projects.find((p) => p.id === key.project_id)?.name ?? "Unknown"
                        : "Default"}
                    </span>
                    {" · "}
                    Rate limit:{" "}
                    <span className="font-medium text-[var(--ink)]">
                      {key.rate_limit ? `${key.rate_limit} req/min` : "Plan default"}
                    </span>
                    {" · "}
                    Expires:{" "}
                    <span className={`font-medium ${key.expires_at && new Date(key.expires_at) < new Date() ? "text-red-600 dark:text-red-400" : "text-[var(--ink)]"}`}>
                      {formatExpiry(key.expires_at)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        try {
                          const rotated = await rotateSigningSecret(key.id);
                          setCreatedCreds({
                            rawKey: "(unchanged — secret API key was not rotated)",
                            accessKey: rotated.accessKey,
                            signingSecret: rotated.signingSecret,
                          });
                          setKeys((prev) =>
                            prev.map((k) =>
                              k.id === key.id
                                ? { ...k, access_key: rotated.accessKey, has_signing_secret: true }
                                : k
                            )
                          );
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Could not rotate signing secret.");
                        }
                      });
                    }}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] transition-colors"
                  >
                    {key.has_signing_secret ? "Rotate signing" : "Enable signed URLs"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditKeyId(editKeyId === key.id ? null : key.id)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] transition-colors"
                  >
                    {editKeyId === key.id ? "Close" : "Settings"}
                  </button>
                  <button
                    onClick={() => handleToggle(key.id, key.is_active)}
                    disabled={isPending}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      key.is_active
                        ? "border-[var(--line)] hover:bg-[var(--muted)]"
                        : "border-orange-200 dark:border-orange-800 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/50"
                    }`}
                  >
                    {key.is_active ? "Disable" : "Enable"}
                  </button>
                  {revokeConfirmId === key.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRevoke(key.id)}
                        disabled={isPending}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                      >
                        {isPending ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setRevokeConfirmId(null)}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRevokeConfirmId(key.id)}
                      className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
              {editKeyId === key.id && (
                <KeySettingsEditor
                  keyId={key.id}
                  rateLimit={key.rate_limit}
                  expiresAt={key.expires_at}
                  projectId={key.project_id}
                  projects={projects}
                  onSaved={(patch) => {
                    setKeys((prev) =>
                      prev.map((k) => (k.id === key.id ? { ...k, ...patch } : k))
                    );
                    setEditKeyId(null);
                  }}
                  onCancel={() => setEditKeyId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
