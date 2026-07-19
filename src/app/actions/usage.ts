import { createServiceClient } from "@/lib/supabase/server";

const supabase = createServiceClient();

export async function logScreenshotUsage(params: {
  userId: string;
  apiKeyId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  screenshotUrl?: string;
  cached: boolean;
  responseTimeMs: number;
}) {
  const { error: logError } = await supabase.from("api_key_logs").insert({
    user_id: params.userId,
    api_key_id: params.apiKeyId ?? null,
    endpoint: params.endpoint,
    method: params.method,
    status_code: params.statusCode,
    screenshot_url: params.screenshotUrl ?? null,
    cached: params.cached,
    response_time_ms: params.responseTimeMs,
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
  const quotaResult = await supabase
    .from("user_quotas")
    .select("plan, monthly_limit, monthly_used, quota_reset_at")
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
    cacheHitRate,
    totalCalls,
  };
}

export async function getScreenshotHistory(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("screenshots")
    .select("id, url, storage_url, format, width, height, file_size_bytes, cached, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id, email, first_name, last_name, image_url, created_at")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}
