"use client";

import { useState, useTransition } from "react";
import { listUsersWithRoles, setUserRole, type AdminUserRow } from "@/app/actions/admin";

export function AdminRoleManager({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function search(q: string) {
    setQuery(q);
    setError(null);
    startTransition(async () => {
      try {
        setUsers(await listUsersWithRoles(q));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      }
    });
  }

  function changeRole(userId: string, role: "admin" | "user") {
    setError(null);
    startTransition(async () => {
      try {
        await setUserRole(userId, role);
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 dark:bg-[var(--card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="panel-heading">User roles</h2>
          <p className="mt-1 text-xs text-[var(--dim)] dark:text-[var(--dim)]">
            Promote or demote admins. Stored in <code className="font-mono">users.role</code> — takes effect
            immediately, no redeploy needed.
          </p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search by email…"
          className="w-64 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-orange-500"
        />
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--dim)]">
              <th className="py-2 pr-4 text-left font-medium">User</th>
              <th className="py-2 pr-4 text-left font-medium">Email</th>
              <th className="py-2 pr-4 text-left font-medium">Joined</th>
              <th className="py-2 text-left font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-[var(--dim)]">
                  {pending ? "Loading…" : "No users found."}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5 pr-4">{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="py-2.5 pr-4 text-[var(--dim)]">{u.email ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-[var(--dim)]">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2.5">
                    <select
                      value={u.role === "admin" ? "admin" : "user"}
                      disabled={pending}
                      onChange={(e) => changeRole(u.id, e.target.value as "admin" | "user")}
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${
                        u.role === "admin"
                          ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--dim)] dark:text-[var(--ink)]"
                      }`}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
