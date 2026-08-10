import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function logScreenshotUsage(params: {
  userId: string;
  apiKeyId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  screenshotUrl?: string | null;
  cached: boolean;
  responseTimeMs: number;
  creditsUsed?: number;
  source?: "app" | "api";
}) {
  const supabase = createServiceClient();
  const { error: logError } = await supabase.from("api_key_logs").insert({
    user_id: params.userId,
    api_key_id: params.apiKeyId ?? null,
    endpoint: params.endpoint,
    method: params.method,
    status_code: params.statusCode,
    screenshot_url: params.screenshotUrl ?? null,
    cached: params.cached,
    response_time_ms: params.responseTimeMs,
    credits_used: params.creditsUsed ?? 0,
    source: params.source ?? "app",
  });

  if (logError) {
    console.error("[logScreenshotUsage] insert failed:", logError.message, logError.details);
  }

  const { error: usageError } = await supabase.rpc("increment_usage", { p_user_id: params.userId });

  if (usageError) {
    console.error("[logScreenshotUsage] increment_usage failed:", usageError.message);
  }
}

export async function getUsageStats(userId: string) {
  const supabase = await createClient();
  const quotaResult = await supabase
    .from("user_quotas")
    .select("plan, monthly_limit, monthly_used, quota_reset_at, credit_balance, credits_used_this_cycle, credits_granted_this_cycle, top_up_balance, overage_enabled")
    .eq("user_id", userId)
    .single();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const logsResult = await supabase
    .from("api_key_logs")
    .select("id, cached", { count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo);

  const totalCalls = logsResult.count ?? 0;
  const cachedCalls = logsResult.data?.filter((l) => l.cached).length ?? 0;
  const cacheHitRate = totalCalls > 0 ? Math.round((cachedCalls / totalCalls) * 100) : 0;

  return {
    plan: quotaResult.data?.plan ?? "free",
    monthlyUsed: quotaResult.data?.monthly_used ?? 0,
    monthlyLimit: quotaResult.data?.monthly_limit ?? 100,
    creditBalance: quotaResult.data?.credit_balance ?? 0,
    creditsUsedThisCycle: quotaResult.data?.credits_used_this_cycle ?? 0,
    creditsGrantedThisCycle: quotaResult.data?.credits_granted_this_cycle ?? 0,
    topUpBalance: quotaResult.data?.top_up_balance ?? 0,
    overageEnabled: quotaResult.data?.overage_enabled ?? false,
    cacheHitRate,
    totalCalls,
  };
}

export async function getScreenshotHistory(userId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screenshots")
    .select("id, url, storage_url, format, width, height, file_size_bytes, cached, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getUserProfile(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select(`
      id, email, first_name, last_name, image_url,
      username, profile_image_url, has_image, locale,
      primary_email_address_id, phone_numbers, external_accounts,
      public_metadata, private_metadata,
      password_enabled, two_factor_enabled, backup_code_enabled,
      banned, locked, last_active_at, last_sign_in_at,
      created_at, updated_at
    `)
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}
