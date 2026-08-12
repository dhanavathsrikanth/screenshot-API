import { createServiceClient } from "@/lib/supabase/server";

// Owner account(s) that can access /dashboard/admin. Overridable via the
// ADMIN_EMAILS and ADMIN_USER_IDS env vars (comma-separated).
const DEFAULT_ADMIN_EMAILS = ["dhanavathsrikanth@gmail.com", "22211a0112@gmail.com"];

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
  return envList("ADMIN_EMAILS") ?? DEFAULT_ADMIN_EMAILS;
}

export function getAdminUserIds(): string[] {
  return envList("ADMIN_USER_IDS") ?? [];
}

// Resolves whether a Clerk user id belongs to an admin. Falls back to the
// email stored by the Clerk webhook (src/app/api/webhooks/clerk/route.ts).
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;

  if (getAdminUserIds().includes(userId)) return true;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle();

    const email = data?.email?.toLowerCase();
    return email ? getAdminEmails().includes(email) : false;
  } catch {
    return false;
  }
}
