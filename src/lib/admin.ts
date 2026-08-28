import { createServiceClient } from "@/lib/supabase/server";

/**
 * Admin access resolution, in order of precedence:
 *
 *  1. `users.role = 'admin'` in the database (primary mechanism — grantable
 *     at runtime via SQL or the admin UI, no redeploy needed).
 *  2. ADMIN_USER_IDS env var (bootstrap fallback — comma-separated Clerk ids).
 *  3. ADMIN_EMAILS env var (bootstrap fallback — matched against the email
 *     stored by the Clerk webhook).
 *
 * The env vars exist so the operator can always promote the very first
 * admin even before any row has role='admin'; day-to-day management should
 * happen through the DB column.
 */
function envList(key: string): string[] | null {
  const raw = process.env[key];
  if (!raw) return null;
  const values = raw
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

export function getAdminEmails(): string[] {
  return envList("ADMIN_EMAILS") ?? [];
}

export function getAdminUserIds(): string[] {
  return envList("ADMIN_USER_IDS") ?? [];
}

/** Promote a user to admin in the DB (the primary, scalable mechanism). */
export async function promoteToAdmin(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("users")
    .update({ role: "admin" })
    .eq("id", userId);
  if (error) throw new Error(`Failed to promote user to admin: ${error.message}`);
}

/** Demote an admin back to a regular user. */
export async function demoteFromAdmin(userId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("users")
    .update({ role: "user" })
    .eq("id", userId);
  if (error) throw new Error(`Failed to demote admin: ${error.message}`);
}

// Resolves whether a Clerk user id belongs to an admin: DB role first, then
// the env-var bootstrap fallbacks (id match, then email from the Clerk
// webhook's users row).
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  if (getAdminUserIds().includes(userId.toLowerCase())) return true;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("users")
      .select("role, email")
      .eq("id", userId)
      .maybeSingle();

    if (data?.role === "admin") return true;

    const email = data?.email?.toLowerCase();
    return email ? getAdminEmails().includes(email) : false;
  } catch {
    return false;
  }
}
