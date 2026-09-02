import { createClient, createServiceClient } from "@/lib/supabase/server";
import { rpcRows } from "@/app/actions/analytics";
import { trackRenderMilestones } from "@/lib/analytics-events";
import { createHash } from "node:crypto";

/** Store a hash of the caller IP, never the raw address. */
export function ipHash(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function logScreenshotUsage(params: {
  userId: string;
  projectId?: string | null;
  apiKeyId?: string;
  requestId?: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  screenshotUrl?: string | null;
  cached: boolean;
  responseTimeMs: number;
  creditsUsed?: number;
  source?: "app" | "api";
  ipHash?: string;
  userAgent?: string;
}) {
  const supabase = createServiceClient();
  const { error: logError } = await supabase.from("api_key_logs").insert({
    user_id: params.userId,
    project_id: params.projectId ?? null,
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

  // Best-effort audit rows — never block a successful response on these.
  supabase
    .from("usage_events")
    .insert({
      user_id: params.userId,
      project_id: params.projectId ?? null,
      api_key_id: params.apiKeyId ?? null,
      event_type: params.endpoint.startsWith("/api/v1") ? "screenshot_created" : "screenshot",
      units: params.creditsUsed ?? 0,
      duration_ms: params.responseTimeMs,
      metadata: { cached: params.cached, method: params.method, request_id: params.requestId },
    })
    .then(() => {}, () => {});

  supabase
    .from("api_requests")
    .insert({
      user_id: params.userId,
      project_id: params.projectId ?? null,
      api_key_id: params.apiKeyId ?? null,
      request_id: params.requestId ?? null,
      endpoint: params.endpoint,
      method: params.method,
      status_code: params.statusCode,
      latency_ms: params.responseTimeMs,
      ip_hash: params.ipHash ?? null,
      user_agent: params.userAgent ?? null,
      cached: params.cached,
    })
    .then(() => {}, () => {});

  const { error: usageError } = await supabase.rpc("increment_usage", { p_user_id: params.userId });

  if (usageError) {
    console.error("[logScreenshotUsage] increment_usage failed:", usageError.message);
  }

  // Activation funnel: fire first_api_request / first_screenshot_completed /
  // 10th_screenshot exactly once at the stored totals.
  if (!params.cached && params.statusCode === 200 && (params.creditsUsed ?? 0) > 0) {
    trackRenderMilestones({
      userId: params.userId,
      endpoint: params.endpoint,
    }).catch(() => {});
  }
}

export async function getUsageStats(userId: string) {
  // Use service role for quota so RLS/JWT mismatch (Clerk ↔ Supabase) never
  // hides the row. History already uses this pattern — dashboard must too.
  const supabase = createServiceClient();
  const quotaResult = await supabase
    .from("user_quotas")
    .select("plan, monthly_limit, monthly_used, quota_reset_at, credit_balance, credits_used_this_cycle, credits_granted_this_cycle, top_up_balance, overage_enabled")
    .eq("user_id", userId)
    .single();

  if (quotaResult.error && quotaResult.error.code !== "PGRST116") {
    // Fallback to authed client before throwing — handles row-level edge cases
    try {
      const authed = await createClient();
      const retry = await authed
        .from("user_quotas")
        .select("plan, monthly_limit, monthly_used, quota_reset_at, credit_balance, credits_used_this_cycle, credits_granted_this_cycle, top_up_balance, overage_enabled")
        .eq("user_id", userId)
        .single();
      if (!retry.error && retry.data) {
        // use retry data
        return buildStatsFromQuota(retry.data, supabase, userId);
      }
    } catch {}
    throw new Error(quotaResult.error.message);
  }

  return buildStatsFromQuota(quotaResult.data, supabase, userId);
}

async function buildStatsFromQuota(
  q: { plan?: string; monthly_limit?: number; monthly_used?: number; quota_reset_at?: string | null; credit_balance?: number; credits_used_this_cycle?: number; credits_granted_this_cycle?: number; top_up_balance?: number; overage_enabled?: boolean } | null,
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
) {
  let totalCalls = 0;
  let cachedCalls = 0;

  const countRows = await rpcRows<{ total: number; cached: number }>("analytics_count_stats", {
    p_user_id: userId,
    p_days: 30,
  });

  if (countRows && countRows.length > 0) {
    totalCalls = countRows[0].total ?? 0;
    cachedCalls = countRows[0].cached ?? 0;
  } else {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const logsResult = await supabase
      .from("api_key_logs")
      .select("id, cached", { count: "exact" })
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo);

    totalCalls = logsResult.count ?? 0;
    cachedCalls = logsResult.data?.filter((l) => l.cached).length ?? 0;
  }

  const cacheHitRate = totalCalls > 0 ? Math.round((cachedCalls / totalCalls) * 100) : 0;

  // The monthly window (and free-plan credit grant) only rolls over lazily inside
  // try_deduct_credits/adjust_credits on the next API request. If it has already
  // expired, show the reset values so the dashboard never displays stale counters.
  const windowExpired = q?.quota_reset_at ? new Date(q.quota_reset_at).getTime() <= Date.now() : false;
  const plan = q?.plan ?? "free";
  const freeRefill = q?.monthly_limit ?? 100;

  let monthlyUsed = q?.monthly_used ?? 0;
  let creditBalance = q?.credit_balance ?? 0;
  let creditsUsedThisCycle = q?.credits_used_this_cycle ?? 0;
  let creditsGrantedThisCycle = q?.credits_granted_this_cycle ?? 0;

  if (windowExpired) {
    monthlyUsed = 0;
    creditsUsedThisCycle = 0;
    if (plan === "free") {
      creditBalance = freeRefill;
      creditsGrantedThisCycle = freeRefill;
    }
  }

  // Cross-check: sum of credits_used from api_key_logs for this cycle — if the
  // quota row is stale (cache race), surface the higher value so consumed credits
  // are never under-reported.
  try {
    const cycleStart = q?.quota_reset_at
      ? new Date(new Date(q.quota_reset_at).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from("api_key_logs")
      .select("credits_used")
      .eq("user_id", userId)
      .gte("created_at", cycleStart);
    const summed = (recentLogs ?? []).reduce((s: number, r: { credits_used?: number }) => s + (r.credits_used ?? 0), 0);
    if (summed > creditsUsedThisCycle) {
      // Prefer the audit sum when it exceeds the quota counter (eventual consistency window)
      creditsUsedThisCycle = summed;
    }
  } catch {}

  return {
    plan,
    monthlyUsed,
    monthlyLimit: q?.monthly_limit ?? 100,
    creditBalance,
    creditsUsedThisCycle,
    creditsGrantedThisCycle,
    topUpBalance: q?.top_up_balance ?? 0,
    overageEnabled: q?.overage_enabled ?? false,
    cacheHitRate,
    totalCalls,
    quotaResetAt: q?.quota_reset_at ?? null,
  };
}

import type { ScreenshotRow } from "@/lib/history-types";

/** Server-side history filters — applied in SQL, not over loaded pages. */
export type HistoryFilterParams = {
  /** "all" or a lowercase format (png, jpeg, webp, pdf…). */
  format?: string;
  /** "all" | "api" | "playground" | "cached". */
  source?: string;
  /** URL substring (case-insensitive). */
  query?: string;
  /** ISO timestamp — only rows created at/after this time. */
  from?: string;
  /** ISO timestamp — only rows created at/before this time. */
  to?: string;
  /** Filter by project UUID. */
  projectId?: string;
};

function applyHistoryFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: HistoryFilterParams | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  if (!filters) return query;
  if (filters.format && filters.format !== "all") {
    query = query.eq("format", filters.format.toLowerCase());
  }
  if (filters.source === "api") {
    // New rows carry metadata->>source = "api"; legacy rows only have a method.
    query = query.or(
      "metadata->>source.eq.api,and(metadata->>source.is.null,metadata->>method.not.is.null)"
    );
  } else if (filters.source === "playground") {
    // New rows carry metadata->>source = "app"; legacy rows had no method.
    query = query.or(
      "metadata->>source.eq.app,and(metadata->>source.is.null,metadata->>method.is.null)"
    );
  } else if (filters.source === "cached") {
    query = query.eq("cached", true);
  }
  if (filters.query) {
    query = query.ilike("url", `%${filters.query}%`);
  }
  if (filters.from) {
    const from = new Date(filters.from);
    if (!Number.isNaN(from.getTime())) query = query.gte("created_at", from.toISOString());
  }
  if (filters.to) {
    const to = new Date(filters.to);
    if (!Number.isNaN(to.getTime())) {
      // Include the whole end day when a bare date is supplied.
      const end = new Date(to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) end.setHours(23, 59, 59, 999);
      query = query.lte("created_at", end.toISOString());
    }
  }
  if (filters.projectId) {
    query = query.eq("project_id", filters.projectId);
  }
  return query;
}

/**
 * Cursor-paginated screenshot history, newest first. Pass `before` (an ISO
 * timestamp from the previous page's last row) to fetch the next older page,
 * optionally narrowed by server-side filters.
 */
export async function getScreenshotHistory(
  userId: string,
  options: { limit?: number; before?: string; filters?: HistoryFilterParams } = {}
): Promise<ScreenshotRow[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 100);
  // Service role + explicit user_id filter: history rows are written via the
  // service role (saveScreenshot), so RLS/JWT misalignment must not hide them.
  const supabase = createServiceClient();

  let query = supabase
    .from("screenshots")
    .select("id, url, storage_url, format, width, height, file_size_bytes, cached, created_at, metadata")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  query = applyHistoryFilters(query, options.filters);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ScreenshotRow[];
}

/** Aggregate stats for the history summary strip. Uses a SQL aggregate RPC so
 * the query never loads every row into memory; falls back to the old JS scan
 * when the RPC is unavailable (pre-migration databases). */
export async function getScreenshotHistoryStats(userId: string): Promise<{
  total: number;
  totalBytes: number;
  viaApi: number;
  cachedCount: number;
}> {
  const supabase = createServiceClient();

  const { data: rpcData, error: rpcError } = await supabase
    .rpc("get_screenshot_history_stats", { p_user_id: userId });

  const row = Array.isArray(rpcData) ? rpcData[0] : (rpcData as Record<string, number> | null);
  if (!rpcError && row) {
    return {
      total: Number(row.total ?? 0),
      totalBytes: Number(row.total_bytes ?? 0),
      viaApi: Number(row.via_api ?? 0),
      cachedCount: Number(row.cached_count ?? 0),
    };
  }

  // Fallback: legacy full scan.
  const { data, error } = await supabase
    .from("screenshots")
    .select("file_size_bytes, cached, metadata")
    .eq("user_id", userId);

  if (error) throw error;

  let totalBytes = 0;
  let viaApi = 0;
  let cachedCount = 0;
  for (const row of data ?? []) {
    totalBytes += row.file_size_bytes ?? 0;
    if (row.cached) cachedCount++;
    const meta = (row.metadata ?? {}) as { source?: string; method?: string };
    if (meta.source === "api" || meta.method) viaApi++;
  }

  return { total: data?.length ?? 0, totalBytes, viaApi, cachedCount };
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
