"use server";

import { createClient } from "@/lib/supabase/server";
import { cacheGet, cacheSet } from "@/lib/redis";
import { verifyProjectOwnership } from "@/app/actions/projects";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function dateRange(days: number) {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  return dates;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
  });
}

async function assertProjectAccess(userId: string, projectId: string): Promise<void> {
  const owned = await verifyProjectOwnership(userId, projectId);
  if (!owned) throw new Error("Project not found.");
}

type ApiKeyLogRow = {
  status_code: number | null;
  response_time_ms: number | null;
  cached: boolean | null;
  created_at: string;
  api_key_id: string | null;
  endpoint: string | null;
};

type ScreenshotRow = {
  format: string;
  created_at: string;
  file_size_bytes: number | null;
};

/** Dynamic `.select(columns)` loses Supabase inference; callers treat rows as partial slices. */
function projectLogs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  columns: string
) {
  return supabase
    .from("api_key_logs")
    .select(columns)
    .eq("user_id", userId)
    .eq("project_id", projectId) as any;
}

function projectScreenshots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  columns: string
) {
  return supabase
    .from("screenshots")
    .select(columns)
    .eq("user_id", userId)
    .eq("project_id", projectId) as any;
}

export type ProjectSummaryStats = {
  totalRequests: number;
  avgLatency: number;
  p99Latency: number;
  cacheHitRate: number;
  errorRate: number;
  apiKeyCount: number;
  screenshotCount: number;
  webhookCount: number;
  usage30d: number;
};

export async function getProjectSummaryStats(
  userId: string,
  projectId: string,
  days = 30
): Promise<ProjectSummaryStats> {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:summary:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<ProjectSummaryStats>(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const since = daysAgo(days);

  const [logsRes, keysRes, shotsRes, hooksRes, usageRes] = await Promise.all([
    projectLogs(supabase, userId, projectId, "status_code, response_time_ms, cached")
      .gte("created_at", since),
    supabase.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("project_id", projectId),
    supabase.from("screenshots").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("project_id", projectId),
    supabase.from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("project_id", projectId),
    supabase.from("usage_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("project_id", projectId).gte("created_at", since),
  ]);

  const logs = (logsRes.data ?? []) as Pick<ApiKeyLogRow, "status_code" | "response_time_ms" | "cached">[];
  const total = logs.length;
  const successes = logs.filter((l) => (l.status_code ?? 0) >= 200 && (l.status_code ?? 0) < 300).length;
  const cachedCount = logs.filter((l) => l.cached).length;
  const latencies = logs
    .filter((l): l is typeof l & { response_time_ms: number } => l.response_time_ms != null)
    .map((l) => l.response_time_ms)
    .sort((a, b) => a - b);

  const result: ProjectSummaryStats = {
    totalRequests: total,
    avgLatency: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    p99Latency: percentile(latencies, 99),
    cacheHitRate: total > 0 ? Math.round((cachedCount / total) * 100) : 0,
    errorRate: total > 0 ? Math.round(((total - successes) / total) * 10000) / 100 : 0,
    apiKeyCount: keysRes.count ?? 0,
    screenshotCount: shotsRes.count ?? 0,
    webhookCount: hooksRes.count ?? 0,
    usage30d: usageRes.count ?? 0,
  };

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectDailyUsage(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:daily:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<{ date: string; count: number; ma7: number }[]>(cacheKey);
  if (cached) return cached;

  const buckets: Record<string, number> = {};
  for (const d of dateRange(days)) buckets[d] = 0;

  const supabase = await createClient();
  const { data } = await projectLogs(supabase, userId, projectId, "created_at")
    .gte("created_at", daysAgo(days))
    .order("created_at", { ascending: true });

  for (const row of data ?? []) buckets[row.created_at.slice(0, 10)]++;

  const dates = Object.keys(buckets);
  const counts = Object.values(buckets);
  const ma7 = movingAverage(counts, 7);
  const result = dates.map((date, i) => ({ date, count: counts[i], ma7: ma7[i] }));

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectLatencyStats(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:latency:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<{ date: string; avg: number; p50: number; p95: number; p99: number }[]>(cacheKey);
  if (cached) return cached;

  const dates = dateRange(days);
  const byDay: Record<string, number[]> = {};
  for (const d of dates) byDay[d] = [];

  const supabase = await createClient();
  const { data } = await projectLogs(supabase, userId, projectId, "response_time_ms, created_at")
    .gte("created_at", daysAgo(days))
    .not("response_time_ms", "is", null)
    .order("created_at", { ascending: true });

  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    if (byDay[day]) byDay[day].push(row.response_time_ms);
  }

  const result = dates.map((date) => {
    const times = byDay[date];
    const sorted = [...times].sort((a, b) => a - b);
    return {
      date,
      avg: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  });

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectPeakHours(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:peak:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<{ day: string; hour: number; count: number }[]>(cacheKey);
  if (cached) return cached;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatmap: Record<string, Record<number, number>> = {};
  for (const d of dayNames) {
    heatmap[d] = {};
    for (let h = 0; h < 24; h++) heatmap[d][h] = 0;
  }

  const supabase = await createClient();
  const { data } = await projectLogs(supabase, userId, projectId, "created_at")
    .gte("created_at", daysAgo(days));

  for (const row of data ?? []) {
    const dt = new Date(row.created_at);
    const dayName = dayNames[dt.getUTCDay()];
    heatmap[dayName][dt.getUTCHours()]++;
  }

  const result: { day: string; hour: number; count: number }[] = [];
  for (const day of dayNames) {
    for (let h = 0; h < 24; h++) result.push({ day, hour: h, count: heatmap[day][h] });
  }

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectEndpointBreakdown(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:endpoint:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<{ name: string; value: number }[]>(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const { data } = await projectLogs(supabase, userId, projectId, "endpoint")
    .gte("created_at", daysAgo(days));

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const name =
      row.endpoint === "/api/take" ? "Single" :
      row.endpoint === "/api/take/bulk" ? "Bulk" :
      row.endpoint ?? "Other";
    counts[name] = (counts[name] ?? 0) + 1;
  }

  const result = Object.entries(counts).map(([name, value]) => ({ name, value }));
  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectFormatDistribution(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:format:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<{ name: string; value: number }[]>(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const { data } = await projectScreenshots(supabase, userId, projectId, "format")
    .gte("created_at", daysAgo(days));

  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.format] = (counts[row.format] ?? 0) + 1;

  const result = Object.entries(counts).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectStatusBreakdown(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:status:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<{ name: string; value: number }[]>(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const { data } = await projectLogs(supabase, userId, projectId, "status_code")
    .gte("created_at", daysAgo(days));

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const label =
      row.status_code >= 200 && row.status_code < 300 ? "2xx" :
      row.status_code >= 400 && row.status_code < 500 ? "4xx" :
      row.status_code >= 500 ? "5xx" :
      String(row.status_code);
    counts[label] = (counts[label] ?? 0) + 1;
  }

  const result = Object.entries(counts).map(([name, value]) => ({ name, value }));
  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectCacheTrend(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:cache:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<{ date: string; rate: number }[]>(cacheKey);
  if (cached) return cached;

  const byDay: Record<string, { total: number; cached: number }> = {};
  for (const d of dateRange(days)) byDay[d] = { total: 0, cached: 0 };

  const supabase = await createClient();
  const { data } = await projectLogs(supabase, userId, projectId, "cached, created_at")
    .gte("created_at", daysAgo(days));

  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, cached: 0 };
    byDay[day].total++;
    if (row.cached) byDay[day].cached++;
  }

  const result = Object.entries(byDay).map(([date, { total, cached }]) => ({
    date,
    rate: total > 0 ? Math.round((cached / total) * 100) : 0,
  }));

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectKeyUsageStats(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:keys:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<
    {
      id: string;
      name: string;
      prefix: string;
      isActive: boolean;
      calls: number;
      errors: number;
      errorRate: number;
      avgLatency: number;
      p95Latency: number;
      health: "healthy" | "warning" | "inactive";
      lastUsedAt: string | null;
      callsPerDay: number;
    }[]
  >(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, is_active, last_used_at, created_at")
    .eq("user_id", userId)
    .eq("project_id", projectId);

  if (!keys || keys.length === 0) return [];

  const stats: Record<string, { calls: number; errors: number; avgLatency: number; p95Latency: number }> = {};
  const latencies: Record<string, number[]> = {};
  for (const k of keys) {
    stats[k.id] = { calls: 0, errors: 0, avgLatency: 0, p95Latency: 0 };
    latencies[k.id] = [];
  }

  const { data: logs } = await projectLogs(supabase, userId, projectId, "api_key_id, response_time_ms, status_code")
    .in("api_key_id", keys.map((k) => k.id))
    .gte("created_at", daysAgo(days));

  for (const log of logs ?? []) {
    if (!log.api_key_id || !stats[log.api_key_id]) continue;
    stats[log.api_key_id].calls++;
    if (log.status_code && log.status_code >= 400) stats[log.api_key_id].errors++;
    if (log.response_time_ms) latencies[log.api_key_id].push(log.response_time_ms);
  }

  const now = Date.now();
  const result = keys.map((k) => {
    const sorted = [...latencies[k.id]].sort((a, b) => a - b);
    stats[k.id].avgLatency = sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
    stats[k.id].p95Latency = percentile(sorted, 95);

    const s = stats[k.id];
    const daysSinceCreated = Math.max(1, Math.floor((now - new Date(k.created_at).getTime()) / 86400000));
    const daysSinceLastUsed = k.last_used_at
      ? Math.floor((now - new Date(k.last_used_at).getTime()) / 86400000)
      : null;

    let health: "healthy" | "warning" | "inactive" = "healthy";
    if (!k.is_active || daysSinceLastUsed === null) health = "inactive";
    else if (daysSinceLastUsed > 30) health = "inactive";
    else if (daysSinceLastUsed > 7) health = "warning";

    const errorRate = s.calls > 0 ? Math.round((s.errors / s.calls) * 100) : 0;
    if (errorRate > 10) health = "warning";

    return {
      id: k.id,
      name: k.name,
      prefix: k.key_prefix,
      isActive: k.is_active,
      calls: s.calls,
      errors: s.errors,
      errorRate,
      avgLatency: s.avgLatency,
      p95Latency: s.p95Latency,
      health,
      lastUsedAt: k.last_used_at,
      callsPerDay: Math.round(s.calls / daysSinceCreated),
    };
  });

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

export async function getProjectBandwidthStats(userId: string, projectId: string, days = 30) {
  await assertProjectAccess(userId, projectId);

  const cacheKey = `cache:project-analytics:bandwidth:${userId}:${projectId}:${days}`;
  const cached = await cacheGet<{ date: string; mb: number }[]>(cacheKey);
  if (cached) return cached;

  const byDay: Record<string, number> = {};
  for (const d of dateRange(days)) byDay[d] = 0;

  const supabase = await createClient();
  const { data } = await projectScreenshots(supabase, userId, projectId, "file_size_bytes, created_at")
    .gte("created_at", daysAgo(days))
    .not("file_size_bytes", "is", null);

  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    byDay[day] += row.file_size_bytes ?? 0;
  }

  const result = Object.entries(byDay).map(([date, bytes]) => ({
    date,
    mb: Math.round((bytes / (1024 * 1024)) * 100) / 100,
  }));

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}
