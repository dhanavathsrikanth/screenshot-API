"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export type DashboardAccessIssue =
  | "auth_token_missing"
  | "clerk_supabase_mismatch"
  | "quota_missing"
  | "database_error";

export type DashboardAccessStatus = {
  ok: boolean;
  issue?: DashboardAccessIssue;
  message?: string;
};

function isAuthError(error: { message?: string; code?: string; status?: number | undefined }) {
  const msg = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";
  return (
    error.status === 401 ||
    code === "PGRST301" ||
    msg.includes("jwt") ||
    msg.includes("invalid claim") ||
    msg.includes("not authenticated") ||
    msg.includes("unauthorized")
  );
}

/**
 * Verify that Clerk session tokens can read this user's data through Supabase RLS.
 * Used to surface Clerk/Supabase provider misconfiguration before pages show fake zeros.
 */
export async function checkDashboardDataAccess(userId: string): Promise<DashboardAccessStatus> {
  try {
    const { getToken } = await auth();
    const token = await getToken();
    if (!token) {
      return {
        ok: false,
        issue: "auth_token_missing",
        message: "Could not obtain a Clerk session token for Supabase reads.",
      };
    }

    const supabase = await createClient();

    const quota = await supabase.from("user_quotas").select("user_id").eq("user_id", userId).maybeSingle();
    if (quota.error) {
      if (isAuthError(quota.error)) {
        return {
          ok: false,
          issue: "clerk_supabase_mismatch",
          message: quota.error.message,
        };
      }
      return { ok: false, issue: "database_error", message: quota.error.message };
    }

    const userRow = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
    if (userRow.error) {
      if (isAuthError(userRow.error)) {
        return {
          ok: false,
          issue: "clerk_supabase_mismatch",
          message: userRow.error.message,
        };
      }
      return { ok: false, issue: "database_error", message: userRow.error.message };
    }

    const service = createServiceClient();
    const { count: serviceLogCount } = await service
      .from("api_key_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    const screenshots = await supabase
      .from("screenshots")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (screenshots.error) {
      if (isAuthError(screenshots.error)) {
        return {
          ok: false,
          issue: "clerk_supabase_mismatch",
          message: screenshots.error.message,
        };
      }
      return { ok: false, issue: "database_error", message: screenshots.error.message };
    }

    const hasActivity = (serviceLogCount ?? 0) > 0;
    const rlsSeesScreenshots = (screenshots.count ?? 0) > 0;

    if (hasActivity && !rlsSeesScreenshots && !quota.data) {
      return {
        ok: false,
        issue: "clerk_supabase_mismatch",
        message:
          "Your account has API activity, but dashboard reads returned no quota or history. Clerk and Supabase are likely misaligned.",
      };
    }

    if (hasActivity && !quota.data) {
      return {
        ok: false,
        issue: "quota_missing",
        message: "Usage quota row is missing for your account despite existing API activity.",
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      issue: "database_error",
      message: err instanceof Error ? err.message : "Failed to verify dashboard data access.",
    };
  }
}
