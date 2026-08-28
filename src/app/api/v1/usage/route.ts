import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { getPlanEntitlements, type PlanId } from "@/lib/plans";

export const maxDuration = 60;

type QuotaRow = {
  plan: string;
  monthly_limit: number;
  monthly_used: number;
  quota_reset_at: string | null;
  credit_balance: number;
  credits_used_this_cycle: number;
  credits_granted_this_cycle: number;
  top_up_balance: number;
  overage_enabled: boolean;
};

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }

    const supabase = createServiceClient();

    const quotaResult = await supabase
      .from("user_quotas")
      .select(
        "plan, monthly_limit, monthly_used, quota_reset_at, credit_balance, credits_used_this_cycle, credits_granted_this_cycle, top_up_balance, overage_enabled"
      )
      .eq("user_id", authCtx.userId)
      .single();

    const quota = quotaResult.data as QuotaRow | null;
    if (!quota) {
      return v1Err(404, "not_found", "No usage record found for this account.", requestId);
    }

    const now = Date.now();
    const resetAt = quota.quota_reset_at ? new Date(quota.quota_reset_at).getTime() : null;
    const windowExpired = resetAt !== null && resetAt <= now;
    const freeRefill = quota.monthly_limit ?? 100;

    // Mirror the dashboard rollover logic: a stale window is shown as reset.
    const monthlyUsed = windowExpired ? 0 : (quota.monthly_used ?? 0);
    const creditBalance = windowExpired && quota.plan === "free" ? freeRefill : (quota.credit_balance ?? 0);
    const creditsUsedThisCycle = windowExpired ? 0 : (quota.credits_used_this_cycle ?? 0);
    const creditsGrantedThisCycle = windowExpired && quota.plan === "free" ? freeRefill : (quota.credits_granted_this_cycle ?? 0);

    // Count requests + cache hits inside the current billing window.
    const periodStart = resetAt && !windowExpired ? new Date(resetAt).toISOString() : new Date(now).toISOString();
    const logsResult = await supabase
      .from("api_key_logs")
      .select("id, cached", { count: "exact" })
      .eq("user_id", authCtx.userId)
      .gte("created_at", periodStart);

    const totalRequests = logsResult.count ?? 0;
    const cachedRequests = logsResult.data?.filter((l) => l.cached).length ?? 0;
    const cacheHitRate = totalRequests > 0 ? Math.round((cachedRequests / totalRequests) * 100) : 0;

    return v1Ok({
      plan: quota.plan,
      entitlements: getPlanEntitlements((quota.plan ?? "free") as PlanId),
      period: {
        start: periodStart,
        end: resetAt && !windowExpired ? quota.quota_reset_at : new Date(now).toISOString(),
        reset_at: quota.quota_reset_at,
      },
      requests: {
        used: monthlyUsed,
        limit: quota.monthly_limit ?? 100,
        remaining: Math.max(0, (quota.monthly_limit ?? 100) - monthlyUsed),
      },
      requests_this_window: {
        total: totalRequests,
        cached: cachedRequests,
        cache_hit_rate: cacheHitRate,
      },
      credits: {
        used_this_cycle: creditsUsedThisCycle,
        granted_this_cycle: creditsGrantedThisCycle,
        balance: creditBalance,
        top_up_balance: quota.top_up_balance ?? 0,
        overage_enabled: quota.overage_enabled ?? false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
