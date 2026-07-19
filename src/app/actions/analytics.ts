import { createServiceClient } from "@/lib/supabase/server";

const supabase = createServiceClient();

// ─── Helpers ────────────────────────────────────────────────────────────

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

function linearRegression(data: { x: number; y: number }[]): { slope: number; intercept: number; predict: (x: number) => number } {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0, predict: () => 0 };
  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, predict: (x: number) => Math.max(0, Math.round(slope * x + intercept)) };
}

// ─── Daily Usage with Moving Averages ───────────────────────────────────

export async function getDailyUsage(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("api_key_logs")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days))
    .order("created_at", { ascending: true });

  if (error) return [];

  const buckets: Record<string, number> = {};
  for (const d of dateRange(days)) buckets[d] = 0;
  for (const row of data ?? []) buckets[row.created_at.slice(0, 10)]++;

  const dates = Object.keys(buckets);
  const counts = Object.values(buckets);
  const ma7 = movingAverage(counts, 7);

  return dates.map((date, i) => ({
    date,
    count: counts[i],
    ma7: ma7[i],
  }));
}

// ─── Period Comparisons (WoW, MoM) ─────────────────────────────────────

export async function getPeriodComparisons(userId: string) {
  const thisWeek = await supabase
    .from("api_key_logs").select("id", { count: "exact" })
    .eq("user_id", userId).gte("created_at", daysAgo(7));

  const lastWeek = await supabase
    .from("api_key_logs").select("id", { count: "exact" })
    .eq("user_id", userId).gte("created_at", daysAgo(14)).lt("created_at", daysAgo(7));

  const thisMonth = await supabase
    .from("api_key_logs").select("id", { count: "exact" })
    .eq("user_id", userId).gte("created_at", daysAgo(30));

  const lastMonth = await supabase
    .from("api_key_logs").select("id", { count: "exact" })
    .eq("user_id", userId).gte("created_at", daysAgo(60)).lt("created_at", daysAgo(30));

  const tw = thisWeek.count ?? 0;
  const lw = lastWeek.count ?? 0;
  const tm = thisMonth.count ?? 0;
  const lm = lastMonth.count ?? 0;

  return {
    thisWeek: tw,
    lastWeek: lw,
    weekDelta: lw > 0 ? Math.round(((tw - lw) / lw) * 100) : tw > 0 ? 100 : 0,
    thisMonth: tm,
    lastMonth: lm,
    monthDelta: lm > 0 ? Math.round(((tm - lm) / lm) * 100) : tm > 0 ? 100 : 0,
  };
}

// ─── Latency Stats with Percentiles ────────────────────────────────────

export async function getLatencyStats(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("api_key_logs")
    .select("response_time_ms, created_at")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days))
    .not("response_time_ms", "is", null)
    .order("created_at", { ascending: true });

  if (error) return [];

  const byDay: Record<string, number[]> = {};
  for (const d of dateRange(days)) byDay[d] = [];
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    if (byDay[day]) byDay[day].push(row.response_time_ms);
  }

  return Object.entries(byDay).map(([date, times]) => {
    const sorted = [...times].sort((a, b) => a - b);
    return {
      date,
      avg: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  });
}

// ─── Peak Hours Heatmap ────────────────────────────────────────────────

export async function getPeakHours(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("api_key_logs")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days));

  if (error) return [];

  const heatmap: Record<string, Record<number, number>> = {};
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const d of dayNames) {
    heatmap[d] = {};
    for (let h = 0; h < 24; h++) heatmap[d][h] = 0;
  }

  for (const row of data ?? []) {
    const dt = new Date(row.created_at);
    const dayName = dayNames[dt.getUTCDay()];
    const hour = dt.getUTCHours();
    heatmap[dayName][hour]++;
  }

  const result: { day: string; hour: number; count: number }[] = [];
  for (const day of dayNames) {
    for (let h = 0; h < 24; h++) {
      result.push({ day, hour: h, count: heatmap[day][h] });
    }
  }
  return result;
}

// ─── Usage Forecasting ─────────────────────────────────────────────────

export async function getUsageForecast(userId: string) {
  const { data } = await supabase
    .from("api_key_logs")
    .select("created_at")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(60))
    .order("created_at", { ascending: true });

  const { data: quota } = await supabase
    .from("user_quotas")
    .select("monthly_limit, monthly_used, quota_reset_at")
    .eq("user_id", userId)
    .single();

  const limits = { monthlyLimit: quota?.monthly_limit ?? 100, monthlyUsed: quota?.monthly_used ?? 0 };

  if (!data || data.length < 7) {
    return { forecast: [], daysUntilLimit: null, ...limits };
  }

  const buckets: Record<string, number> = {};
  for (const d of dateRange(60)) buckets[d] = 0;
  for (const row of data) buckets[row.created_at.slice(0, 10)]++;

  const dates = Object.keys(buckets);
  const counts = Object.values(buckets);
  const regression = linearRegression(dates.map((_, i) => ({ x: i, y: counts[i] })));

  const forecastDays = 30;
  const forecast: { date: string; predicted: number; upper: number }[] = [];
  let cumulative = limits.monthlyUsed;
  let daysUntilLimit: number | null = null;

  for (let i = 0; i < forecastDays; i++) {
    const x = dates.length + i;
    const predicted = regression.predict(x);
    const upper = Math.round(predicted * 1.3);
    const futureDate = new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000);
    forecast.push({
      date: futureDate.toISOString().slice(0, 10),
      predicted,
      upper,
    });
    cumulative += predicted;
    if (cumulative >= limits.monthlyLimit && daysUntilLimit === null) {
      daysUntilLimit = i + 1;
    }
  }

  return { forecast, daysUntilLimit, dailyAvg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length), ...limits };
}

// ─── Cost Estimation ───────────────────────────────────────────────────

export async function getCostEstimation(userId: string) {
  const { data: quota } = await supabase
    .from("user_quotas")
    .select("plan, monthly_used, monthly_limit")
    .eq("user_id", userId)
    .single();

  const plan = quota?.plan ?? "free";
  const monthlyUsed = quota?.monthly_used ?? 0;

  const { data: pricing } = await supabase
    .from("plan_pricing")
    .select("*")
    .eq("plan", plan)
    .single();

  const { data: screenshots } = await supabase
    .from("screenshots")
    .select("file_size_bytes")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(30))
    .not("file_size_bytes", "is", null);

  const totalStorageBytes = (screenshots ?? []).reduce((sum, s) => sum + (s.file_size_bytes ?? 0), 0);
  const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);

  const perScreenshotCost = pricing?.per_screenshot_cost_usd ?? 0;
  const storageCost = totalStorageGB * (pricing?.storage_cost_per_gb_usd ?? 0);
  const computeCost = monthlyUsed * perScreenshotCost;
  const totalEstimatedCost = computeCost + storageCost;
  const monthlyPrice = pricing?.monthly_price_usd ?? 0;

  // Find cheapest plan that covers usage
  const allPlans = await supabase.from("plan_pricing").select("*").order("monthly_price_usd");
  const recommended = (allPlans.data ?? []).find(
    (p) => p.monthly_limit >= monthlyUsed * 1.2
  );

  return {
    plan,
    monthlyPrice,
    monthlyUsed,
    monthlyLimit: quota?.monthly_limit ?? 100,
    computeCost: Math.round(computeCost * 10000) / 10000,
    storageCost: Math.round(storageCost * 10000) / 10000,
    totalEstimatedCost: Math.round(totalEstimatedCost * 10000) / 10000,
    storageGB: Math.round(totalStorageGB * 1000) / 1000,
    costPerScreenshot: perScreenshotCost,
    recommendedPlan: recommended && recommended.plan !== plan ? recommended.plan : null,
  };
}

// ─── Endpoint Breakdown ────────────────────────────────────────────────

export async function getEndpointBreakdown(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("api_key_logs")
    .select("endpoint")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days));

  if (error) return [];

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const name = row.endpoint === "/api/take" ? "Single" : row.endpoint === "/api/take/bulk" ? "Bulk" : row.endpoint;
    counts[name] = (counts[name] ?? 0) + 1;
  }

  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

// ─── Method Breakdown ──────────────────────────────────────────────────

export async function getMethodBreakdown(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("api_key_logs")
    .select("method")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days));

  if (error) return [];

  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.method] = (counts[row.method] ?? 0) + 1;
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

// ─── Format Distribution ───────────────────────────────────────────────

export async function getFormatDistribution(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("screenshots")
    .select("format")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days));

  if (error) return [];

  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.format] = (counts[row.format] ?? 0) + 1;
  return Object.entries(counts).map(([name, value]) => ({ name: name.toUpperCase(), value }));
}

// ─── Cache Trend ───────────────────────────────────────────────────────

export async function getCacheTrend(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("api_key_logs")
    .select("cached, created_at")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days));

  if (error) return [];

  const byDay: Record<string, { total: number; cached: number }> = {};
  for (const d of dateRange(days)) byDay[d] = { total: 0, cached: 0 };

  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, cached: 0 };
    byDay[day].total++;
    if (row.cached) byDay[day].cached++;
  }

  return Object.entries(byDay).map(([date, { total, cached }]) => ({
    date,
    rate: total > 0 ? Math.round((cached / total) * 100) : 0,
    total,
    cached,
  }));
}

// ─── Status Breakdown ──────────────────────────────────────────────────

export async function getStatusBreakdown(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("api_key_logs")
    .select("status_code")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days));

  if (error) return [];

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const label = row.status_code >= 200 && row.status_code < 300 ? "2xx" :
                  row.status_code >= 400 && row.status_code < 500 ? "4xx" :
                  row.status_code >= 500 ? "5xx" : String(row.status_code);
    counts[label] = (counts[label] ?? 0) + 1;
  }

  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

// ─── Key Usage Stats ───────────────────────────────────────────────────

export async function getKeyUsageStats(userId: string, days = 30) {
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, is_active, last_used_at, created_at")
    .eq("user_id", userId);

  if (!keys || keys.length === 0) return [];

  const keyIds = keys.map((k) => k.id);
  const { data: logs } = await supabase
    .from("api_key_logs")
    .select("api_key_id, response_time_ms, status_code")
    .eq("user_id", userId)
    .in("api_key_id", keyIds)
    .gte("created_at", daysAgo(days));

  const stats: Record<string, { calls: number; errors: number; latencies: number[] }> = {};
  for (const k of keys) stats[k.id] = { calls: 0, errors: 0, latencies: [] };

  for (const log of logs ?? []) {
    if (!log.api_key_id || !stats[log.api_key_id]) continue;
    stats[log.api_key_id].calls++;
    if (log.status_code && log.status_code >= 400) stats[log.api_key_id].errors++;
    if (log.response_time_ms) stats[log.api_key_id].latencies.push(log.response_time_ms);
  }

  const now = Date.now();
  return keys.map((k) => {
    const s = stats[k.id];
    const sorted = [...s.latencies].sort((a, b) => a - b);
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
      avgLatency: sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0,
      p95Latency: percentile(sorted, 95),
      health,
      lastUsedAt: k.last_used_at,
      createdAt: k.created_at,
      callsPerDay: Math.round(s.calls / daysSinceCreated),
    };
  });
}

// ─── Bandwidth Stats ───────────────────────────────────────────────────

export async function getBandwidthStats(userId: string, days = 30) {
  const { data, error } = await supabase
    .from("screenshots")
    .select("file_size_bytes, created_at")
    .eq("user_id", userId)
    .gte("created_at", daysAgo(days))
    .not("file_size_bytes", "is", null);

  if (error) return [];

  const byDay: Record<string, number> = {};
  for (const d of dateRange(days)) byDay[d] = 0;
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    byDay[day] += row.file_size_bytes ?? 0;
  }

  return Object.entries(byDay).map(([date, bytes]) => ({
    date,
    mb: Math.round((bytes / (1024 * 1024)) * 100) / 100,
  }));
}

// ─── Usage Alerts ──────────────────────────────────────────────────────

export async function getUsageAlerts(userId: string) {
  const { data } = await supabase
    .from("usage_alerts")
    .select("id, alert_type, threshold_pct, triggered_at, acknowledged")
    .eq("user_id", userId)
    .order("triggered_at", { ascending: false })
    .limit(10);

  return data ?? [];
}

export async function acknowledgeAlert(alertId: string) {
  await supabase.from("usage_alerts").update({ acknowledged: true }).eq("id", alertId);
}

// ─── SLA Incidents ─────────────────────────────────────────────────────

export async function getSLAStats(userId: string, days = 30) {
  const since = daysAgo(days);

  const { data: allLogs } = await supabase
    .from("api_key_logs")
    .select("status_code, response_time_ms, created_at")
    .eq("user_id", userId)
    .gte("created_at", since);

  const { data: incidents } = await supabase
    .from("sla_incidents")
    .select("id, incident_type, endpoint, status_code, response_time_ms, message, resolved, created_at, resolved_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const total = allLogs?.length ?? 0;
  const successes = allLogs?.filter((l) => l.status_code >= 200 && l.status_code < 300).length ?? 0;
  const errors = total - successes;
  const uptime = total > 0 ? Math.round((successes / total) * 10000) / 100 : 100;

  const latencies = (allLogs ?? [])
    .filter((l) => l.response_time_ms != null)
    .map((l) => l.response_time_ms as number)
    .sort((a, b) => a - b);

  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const p99 = percentile(latencies, 99);

  const unresolved = (incidents ?? []).filter((i) => !i.resolved).length;

  return {
    uptime,
    totalRequests: total,
    errors,
    avgLatency,
    p99Latency: p99,
    slaTarget: 99.9,
    uptimeMet: uptime >= 99.9,
    latencyMet: p99 < 5000,
    incidents: incidents ?? [],
    unresolvedIncidents: unresolved,
  };
}
