"use client";

import { useState, useTransition, useCallback } from "react";
import { generateApiKey, revokeApiKey, toggleApiKey } from "@/app/actions/api-keys";
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
};

interface ApiKeysManagerProps {
  initialKeys: ApiKey[];
  projects: ProjectRow[];
}

export function ApiKeysManager({ initialKeys, projects }: ApiKeysManagerProps) {
  const [keys, setKeys] = useState(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<ApiKeyEnvironment>("production");
  const [newKeyProject, setNewKeyProject] = useState<string>("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setError(null);

    try {
      const result = await generateApiKey(
        newKeyName.trim(),
        newKeyEnv,
        newKeyProject || undefined
      );
      setCreatedKey(result.rawKey);
      setKeys((prev) => [
        { id: result.id, name: result.name, key_prefix: result.key_prefix, environment: newKeyEnv, is_active: true, last_used_at: null, created_at: result.created_at },
        ...prev,
      ]);
      setNewKeyName("");
      setShowCreateForm(false);
    } catch {
      setError("Failed to create API key. Please try again.");
    }
  }, [newKeyName, newKeyEnv, newKeyProject]);

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
      } catch {
        setError("Failed to revoke key. Please try again.");
      }
    });
  }, []);

  const copyKey = useCallback(async () => {
    if (!createdKey) return;
    await navigator.clipboard.writeText(createdKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }, [createdKey]);

  return (
    <div>
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 mb-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {createdKey && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 mb-4">
          <p className="text-sm font-medium text-green-800 dark:text-green-300 mb-1">
            API key created successfully
          </p>
          <p className="text-xs text-green-700 dark:text-green-400 mb-3">
            Copy this key now. You won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-green-100 dark:bg-green-900/50 rounded px-3 py-2 font-mono break-all text-green-800 dark:text-green-300">
              {createdKey}
            </code>
            <button
              onClick={copyKey}
              className="flex-shrink-0 rounded-lg border border-green-300 dark:border-green-700 px-3 py-2 text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
            >
              {copiedKey ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
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
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn-primary"
          >
            Create Key
          </button>
        )}
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="flex gap-3 mb-4">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. production, staging)"
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
          <button
            type="submit"
            disabled={isPending || !newKeyName.trim()}
            className="btn-primary disabled:opacity-50"
          >
            {isPending ? "Creating..." : "Create"}
          </button>
          <button
            type="button"
            onClick={() => { setShowCreateForm(false); setNewKeyName(""); }}
            className="btn-secondary"
          >
            Cancel
          </button>
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
              className="rounded-xl border border-[var(--border)] p-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
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
                        : "bg-[var(--muted)] text-[var(--dim)] dark:bg-[var(--muted)] dark:text-[var(--dim)]"
                    }`}
                  >
                    {key.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-[var(--dim)] mt-0.5 font-mono">
                  {key.key_prefix}...
                  <span className="text-[var(--dim)] ml-2">
                    Last used {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "never"}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggle(key.id, key.is_active)}
                  disabled={isPending}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    key.is_active
                      ? "border-[var(--line)] dark:border-[var(--line)] hover:bg-[var(--muted)] dark:hover:bg-[var(--muted)]"
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
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--muted)] dark:hover:bg-[var(--card)] transition-colors"
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
          ))}
        </div>
      )}
    </div>
  );
}
