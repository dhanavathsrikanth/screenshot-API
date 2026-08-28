import { createClient } from "@/lib/supabase/server";
import { cacheGet, cacheSet } from "@/lib/redis";

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

// ─── RPC helper with legacy fallback ────────────────────────────────────
// The analytics SQL functions live in supabase/migrations/008. When they are
// not applied yet we fall back to the previous row-by-row aggregation so
// pages keep working while the migration is being rolled out.

type RpcRow = Record<string, unknown>;

type DailyUsageRow = { date: string; count: number; ma7: number };
type LatencyRow = { date: string; avg: number; p50: number; p95: number; p99: number };
type PeakRow = { day: string; hour: number; count: number };
type NameValueRow = { name: string; value: number };
type CacheTrendRow = { date: string; rate: number; total: number; cached: number };
type BandwidthRow = { date: string; mb: number };
type PeriodComparisonResult = {
  thisWeek: number;
  lastWeek: number;
  weekDelta: number;
  thisMonth: number;
  lastMonth: number;
  monthDelta: number;
};
type ForecastResult = {
  forecast: { date: string; predicted: number; upper: number }[];
  dailyAvg: number;
  monthlyUsed: number;
  monthlyLimit: number;
  daysUntilLimit: number | null;
};
type CostEstimationResult = {
  plan: string;
  monthlyPrice: number;
  monthlyUsed: number;
  monthlyLimit: number;
  computeCost: number;
  storageCost: number;
  totalEstimatedCost: number;
  storageGB: number;
  costPerScreenshot: number;
  recommendedPlan: string | null;
};
type KeyUsageRow = {
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
  createdAt: string;
  callsPerDay: number;
};
type SLAStatsResult = {
  uptime: number;
  totalRequests: number;
  errors: number;
  avgLatency: number;
  p99Latency: number;
  slaTarget: number;
  uptimeMet: boolean;
  latencyMet: boolean;
  incidents: {
    id: string;
    incident_type: string;
    endpoint: string | null;
    status_code: number | null;
    response_time_ms: number | null;
    message: string | null;
    resolved: boolean;
    created_at: string;
    resolved_at: string | null;
  }[];
  unresolvedIncidents: number;
};

export async function rpcRows<T = RpcRow>(
  name: string,
  params: Record<string, unknown>
): Promise<T[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(name, params);
    if (error) return null;
    return (data as T[]) ?? null;
  } catch {
    return null;
  }
}

// ─── Daily Usage with Moving Averages ───────────────────────────────────

export async function getDailyUsage(userId: string, days = 30) {
  const cacheKey = `cache:analytics:daily:${userId}:${days}`;
  const cached = await cacheGet<DailyUsageRow[]>(cacheKey);
  if (cached) return cached;

  const buckets: Record<string, number> = {};
  for (const d of dateRange(days)) buckets[d] = 0;

  const rows = await rpcRows<{ date_key: string; count: number }>("analytics_daily_usage", {
    p_user_id: userId,
    p_days: days,
  });

  if (rows) {
    for (const row of rows) buckets[row.date_key] = row.count;
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_key_logs")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days))
      .order("created_at", { ascending: true });

    if (!error) {
      for (const row of data ?? []) buckets[row.created_at.slice(0, 10)]++;
    }
  }

  const dates = Object.keys(buckets);
  const counts = Object.values(buckets);
  const ma7 = movingAverage(counts, 7);

  const result = dates.map((date, i) => ({
    date,
    count: counts[i],
    ma7: ma7[i],
  }));

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Period Comparisons (WoW, MoM) ─────────────────────────────────────

export async function getPeriodComparisons(userId: string) {
  const cacheKey = `cache:analytics:comparisons:${userId}`;
  const cached = await cacheGet<PeriodComparisonResult>(cacheKey);
  if (cached) return cached;

  let tw = 0;
  let lw = 0;
  let tm = 0;
  let lm = 0;

  const rows = await rpcRows<{ this_week: number; last_week: number; this_month: number; last_month: number }>(
    "analytics_period_comparison",
    { p_user_id: userId }
  );

  if (rows && rows.length > 0) {
    tw = rows[0].this_week ?? 0;
    lw = rows[0].last_week ?? 0;
    tm = rows[0].this_month ?? 0;
    lm = rows[0].last_month ?? 0;
  } else {
    const supabase = await createClient();
    const [twR, lwR, tmR, lmR] = await Promise.all([
      supabase.from("api_key_logs").select("id", { count: "exact" }).eq("user_id", userId).gte("created_at", daysAgo(7)),
      supabase.from("api_key_logs").select("id", { count: "exact" }).eq("user_id", userId).gte("created_at", daysAgo(14)).lt("created_at", daysAgo(7)),
      supabase.from("api_key_logs").select("id", { count: "exact" }).eq("user_id", userId).gte("created_at", daysAgo(30)),
      supabase.from("api_key_logs").select("id", { count: "exact" }).eq("user_id", userId).gte("created_at", daysAgo(60)).lt("created_at", daysAgo(30)),
    ]);
    tw = twR.count ?? 0;
    lw = lwR.count ?? 0;
    tm = tmR.count ?? 0;
    lm = lmR.count ?? 0;
  }

  const result = {
    thisWeek: tw,
    lastWeek: lw,
    weekDelta: lw > 0 ? Math.round(((tw - lw) / lw) * 100) : tw > 0 ? 100 : 0,
    thisMonth: tm,
    lastMonth: lm,
    monthDelta: lm > 0 ? Math.round(((tm - lm) / lm) * 100) : tm > 0 ? 100 : 0,
  };

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Latency Stats with Percentiles ────────────────────────────────────

export async function getLatencyStats(userId: string, days = 30) {
  const cacheKey = `cache:analytics:latency:${userId}:${days}`;
  const cached = await cacheGet<LatencyRow[]>(cacheKey);
  if (cached) return cached;

  const dates = dateRange(days);
  const byDay: Record<string, number[]> = {};
  for (const d of dates) byDay[d] = [];

  let result: { date: string; avg: number; p50: number; p95: number; p99: number }[];

  const rows = await rpcRows<{ date_key: string; avg: number; p50: number; p95: number; p99: number }>(
    "analytics_latency_stats",
    { p_user_id: userId, p_days: days }
  );

  if (rows) {
    const lookup: Record<string, { avg: number; p50: number; p95: number; p99: number }> = {};
    for (const row of rows) lookup[row.date_key] = row;
    result = dates.map((date) => ({
      date,
      avg: lookup[date]?.avg ?? 0,
      p50: lookup[date]?.p50 ?? 0,
      p95: lookup[date]?.p95 ?? 0,
      p99: lookup[date]?.p99 ?? 0,
    }));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_key_logs")
      .select("response_time_ms, created_at")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days))
      .not("response_time_ms", "is", null)
      .order("created_at", { ascending: true });

    if (!error) {
      for (const row of data ?? []) {
        const day = row.created_at.slice(0, 10);
        if (byDay[day]) byDay[day].push(row.response_time_ms);
      }
    }

    result = dates.map((date) => {
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
  }

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Peak Hours Heatmap ────────────────────────────────────────────────

export async function getPeakHours(userId: string, days = 30) {
  const cacheKey = `cache:analytics:peak:${userId}:${days}`;
  const cached = await cacheGet<PeakRow[]>(cacheKey);
  if (cached) return cached;

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatmap: Record<string, Record<number, number>> = {};
  for (const d of dayNames) {
    heatmap[d] = {};
    for (let h = 0; h < 24; h++) heatmap[d][h] = 0;
  }

  const rows = await rpcRows<{ dow: number; hour: number; count: number }>("analytics_peak_hours", {
    p_user_id: userId,
    p_days: days,
  });

  if (rows) {
    for (const row of rows) heatmap[dayNames[row.dow] ?? ""][row.hour] = row.count;
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_key_logs")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days));

    if (!error) {
      for (const row of data ?? []) {
        const dt = new Date(row.created_at);
        const dayName = dayNames[dt.getUTCDay()];
        const hour = dt.getUTCHours();
        heatmap[dayName][hour]++;
      }
    }
  }

  const result: { day: string; hour: number; count: number }[] = [];
  for (const day of dayNames) {
    for (let h = 0; h < 24; h++) {
      result.push({ day, hour: h, count: heatmap[day][h] });
    }
  }
  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Usage Forecasting ─────────────────────────────────────────────────

export async function getUsageForecast(userId: string) {
  const cacheKey = `cache:analytics:forecast:${userId}`;
  const cached = await cacheGet<ForecastResult>(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const { data: quota } = await supabase
    .from("user_quotas")
    .select("monthly_limit, monthly_used, quota_reset_at")
    .eq("user_id", userId)
    .single();

  const limits = { monthlyLimit: quota?.monthly_limit ?? 100, monthlyUsed: quota?.monthly_used ?? 0 };

  const buckets: Record<string, number> = {};
  for (const d of dateRange(60)) buckets[d] = 0;

  const rows = await rpcRows<{ date_key: string; count: number }>("analytics_daily_usage", {
    p_user_id: userId,
    p_days: 60,
  });

  if (rows) {
    for (const row of rows) buckets[row.date_key] = row.count;
  } else {
    const { data } = await supabase
      .from("api_key_logs")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(60))
      .order("created_at", { ascending: true });

    for (const row of data ?? []) buckets[row.created_at.slice(0, 10)]++;
  }

  const dates = Object.keys(buckets);
  const counts = Object.values(buckets);
  const totalLogs = counts.reduce((a, b) => a + b, 0);

  if (totalLogs < 7) {
    return { forecast: [], daysUntilLimit: null, dailyAvg: 0, ...limits };
  }

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

  const result = { forecast, daysUntilLimit, dailyAvg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length), ...limits };
  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Cost Estimation ───────────────────────────────────────────────────

export async function getCostEstimation(userId: string) {
  const cacheKey = `cache:analytics:cost:${userId}`;
  const cached = await cacheGet<CostEstimationResult>(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
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

  let totalStorageBytes = 0;
  const bw = await rpcRows<{ date_key: string; bytes: number }>("analytics_bandwidth", {
    p_user_id: userId,
    p_days: 30,
  });

  if (bw) {
    totalStorageBytes = bw.reduce((sum, row) => sum + Number(row.bytes ?? 0), 0);
  } else {
    const { data: screenshots } = await supabase
      .from("screenshots")
      .select("file_size_bytes")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(30))
      .not("file_size_bytes", "is", null);

    totalStorageBytes = (screenshots ?? []).reduce((sum, s) => sum + (s.file_size_bytes ?? 0), 0);
  }

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

  const result = {
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
  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Endpoint Breakdown ────────────────────────────────────────────────

export async function getEndpointBreakdown(userId: string, days = 30) {
  const cacheKey = `cache:analytics:endpoint:${userId}:${days}`;
  const cached = await cacheGet<NameValueRow[]>(cacheKey);
  if (cached) return cached;

  let result: { name: string; value: number }[] = [];

  const rows = await rpcRows<{ name: string; value: number }>("analytics_endpoint_breakdown", {
    p_user_id: userId,
    p_days: days,
  });

  if (rows) {
    result = rows.map((r) => ({ name: r.name, value: r.value }));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_key_logs")
      .select("endpoint")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days));

    if (!error) {
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const name = row.endpoint === "/api/take" ? "Single" : row.endpoint === "/api/take/bulk" ? "Bulk" : row.endpoint;
        counts[name] = (counts[name] ?? 0) + 1;
      }
      result = Object.entries(counts).map(([name, value]) => ({ name, value }));
    }
  }

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Method Breakdown ──────────────────────────────────────────────────

export async function getMethodBreakdown(userId: string, days = 30) {
  const cacheKey = `cache:analytics:method:${userId}:${days}`;
  const cached = await cacheGet<NameValueRow[]>(cacheKey);
  if (cached) return cached;

  let result: { name: string; value: number }[] = [];

  const rows = await rpcRows<{ name: string; value: number }>("analytics_method_breakdown", {
    p_user_id: userId,
    p_days: days,
  });

  if (rows) {
    result = rows.map((r) => ({ name: r.name, value: r.value }));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_key_logs")
      .select("method")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days));

    if (!error) {
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.method] = (counts[row.method] ?? 0) + 1;
      result = Object.entries(counts).map(([name, value]) => ({ name, value }));
    }
  }

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Format Distribution ───────────────────────────────────────────────

export async function getFormatDistribution(userId: string, days = 30) {
  const cacheKey = `cache:analytics:format:${userId}:${days}`;
  const cached = await cacheGet<NameValueRow[]>(cacheKey);
  if (cached) return cached;

  let result: { name: string; value: number }[] = [];

  const rows = await rpcRows<{ name: string; value: number }>("analytics_format_distribution", {
    p_user_id: userId,
    p_days: days,
  });

  if (rows) {
    result = rows.map((r) => ({ name: r.name, value: r.value }));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("screenshots")
      .select("format")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days));

    if (!error) {
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.format] = (counts[row.format] ?? 0) + 1;
      result = Object.entries(counts).map(([name, value]) => ({ name: name.toUpperCase(), value }));
    }
  }

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Cache Trend ───────────────────────────────────────────────────────

export async function getCacheTrend(userId: string, days = 30) {
  const cacheKey = `cache:analytics:cachetrend:${userId}:${days}`;
  const cached = await cacheGet<CacheTrendRow[]>(cacheKey);
  if (cached) return cached;

  let result: { date: string; rate: number; total: number; cached: number }[] = [];

  const rows = await rpcRows<{ date_key: string; total: number; cached: number }>("analytics_cache_trend", {
    p_user_id: userId,
    p_days: days,
  });

  if (rows) {
    result = rows.map((r) => ({
      date: r.date_key,
      total: r.total,
      cached: r.cached,
      rate: r.total > 0 ? Math.round((r.cached / r.total) * 100) : 0,
    }));
  } else {
    const byDay: Record<string, { total: number; cached: number }> = {};
    for (const d of dateRange(days)) byDay[d] = { total: 0, cached: 0 };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_key_logs")
      .select("cached, created_at")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days));

    if (!error) {
      for (const row of data ?? []) {
        const day = row.created_at.slice(0, 10);
        if (!byDay[day]) byDay[day] = { total: 0, cached: 0 };
        byDay[day].total++;
        if (row.cached) byDay[day].cached++;
      }
    }

    result = Object.entries(byDay).map(([date, { total, cached }]) => ({
      date,
      rate: total > 0 ? Math.round((cached / total) * 100) : 0,
      total,
      cached,
    }));
  }

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Status Breakdown ──────────────────────────────────────────────────

export async function getStatusBreakdown(userId: string, days = 30) {
  const cacheKey = `cache:analytics:status:${userId}:${days}`;
  const cached = await cacheGet<NameValueRow[]>(cacheKey);
  if (cached) return cached;

  let result: { name: string; value: number }[] = [];

  const rows = await rpcRows<{ name: string; value: number }>("analytics_status_breakdown", {
    p_user_id: userId,
    p_days: days,
  });

  if (rows) {
    result = rows.map((r) => ({ name: r.name, value: r.value }));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("api_key_logs")
      .select("status_code")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days));

    if (!error) {
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        const label = row.status_code >= 200 && row.status_code < 300 ? "2xx" :
                      row.status_code >= 400 && row.status_code < 500 ? "4xx" :
                      row.status_code >= 500 ? "5xx" : String(row.status_code);
        counts[label] = (counts[label] ?? 0) + 1;
      }
      result = Object.entries(counts).map(([name, value]) => ({ name, value }));
    }
  }

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Key Usage Stats ───────────────────────────────────────────────────

export async function getKeyUsageStats(userId: string, days = 30) {
  const cacheKey = `cache:analytics:keys:${userId}:${days}`;
  const cached = await cacheGet<KeyUsageRow[]>(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, is_active, last_used_at, created_at")
    .eq("user_id", userId);

  if (!keys || keys.length === 0) return [];

  const stats: Record<string, { calls: number; errors: number; avgLatency: number; p95Latency: number }> = {};
  for (const k of keys) stats[k.id] = { calls: 0, errors: 0, avgLatency: 0, p95Latency: 0 };

  const rows = await rpcRows<{ api_key_id: string; calls: number; errors: number; avg_latency: number; p95_latency: number }>(
    "analytics_key_usage",
    { p_user_id: userId, p_days: days }
  );

  if (rows) {
    for (const row of rows) {
      if (stats[row.api_key_id]) {
        stats[row.api_key_id] = {
          calls: row.calls ?? 0,
          errors: row.errors ?? 0,
          avgLatency: row.avg_latency ?? 0,
          p95Latency: row.p95_latency ?? 0,
        };
      }
    }
  } else {
    const { data: logs } = await supabase
      .from("api_key_logs")
      .select("api_key_id, response_time_ms, status_code")
      .eq("user_id", userId)
      .in("api_key_id", keys.map((k) => k.id))
      .gte("created_at", daysAgo(days));

    const latencies: Record<string, number[]> = {};
    for (const k of keys) latencies[k.id] = [];

    for (const log of logs ?? []) {
      if (!log.api_key_id || !stats[log.api_key_id]) continue;
      stats[log.api_key_id].calls++;
      if (log.status_code && log.status_code >= 400) stats[log.api_key_id].errors++;
      if (log.response_time_ms) latencies[log.api_key_id].push(log.response_time_ms);
    }

    for (const k of keys) {
      const sorted = [...latencies[k.id]].sort((a, b) => a - b);
      stats[k.id].avgLatency = sorted.length > 0 ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0;
      stats[k.id].p95Latency = percentile(sorted, 95);
    }
  }

  const now = Date.now();
  const result = keys.map((k) => {
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
      createdAt: k.created_at,
      callsPerDay: Math.round(s.calls / daysSinceCreated),
    };
  });

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Bandwidth Stats ───────────────────────────────────────────────────

export async function getBandwidthStats(userId: string, days = 30) {
  const cacheKey = `cache:analytics:bandwidth:${userId}:${days}`;
  const cached = await cacheGet<BandwidthRow[]>(cacheKey);
  if (cached) return cached;

  const byDay: Record<string, number> = {};
  for (const d of dateRange(days)) byDay[d] = 0;

  const rows = await rpcRows<{ date_key: string; bytes: number }>("analytics_bandwidth", {
    p_user_id: userId,
    p_days: days,
  });

  if (rows) {
    for (const row of rows) byDay[row.date_key] = Number(row.bytes ?? 0);
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("screenshots")
      .select("file_size_bytes, created_at")
      .eq("user_id", userId)
      .gte("created_at", daysAgo(days))
      .not("file_size_bytes", "is", null);

    if (!error) {
      for (const row of data ?? []) {
        const day = row.created_at.slice(0, 10);
        byDay[day] += row.file_size_bytes ?? 0;
      }
    }
  }

  const result = Object.entries(byDay).map(([date, bytes]) => ({
    date,
    mb: Math.round((bytes / (1024 * 1024)) * 100) / 100,
  }));

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}

// ─── Usage Alerts ──────────────────────────────────────────────────────

export async function getUsageAlerts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usage_alerts")
    .select("id, alert_type, threshold_pct, triggered_at, acknowledged")
    .eq("user_id", userId)
    .order("triggered_at", { ascending: false })
    .limit(10);

  return data ?? [];
}

export async function acknowledgeAlert(alertId: string) {
  const supabase = await createClient();
  await supabase.from("usage_alerts").update({ acknowledged: true }).eq("id", alertId);
}

// ─── SLA Incidents ─────────────────────────────────────────────────────

export async function getSLAStats(userId: string, days = 30) {
  const cacheKey = `cache:analytics:sla:${userId}:${days}`;
  const cached = await cacheGet<SLAStatsResult>(cacheKey);
  if (cached) return cached;

  const supabase = await createClient();
  const since = daysAgo(days);

  let total = 0;
  let successes = 0;
  let avgLatency = 0;
  let p99 = 0;

  const rows = await rpcRows<{ total: number; successes: number; errors: number; avg_latency: number; p99_latency: number }>(
    "analytics_sla_stats",
    { p_user_id: userId, p_days: days }
  );

  if (rows && rows.length > 0) {
    total = rows[0].total ?? 0;
    successes = rows[0].successes ?? 0;
    avgLatency = rows[0].avg_latency ?? 0;
    p99 = rows[0].p99_latency ?? 0;
  } else {
    const { data: allLogs } = await supabase
      .from("api_key_logs")
      .select("status_code, response_time_ms, created_at")
      .eq("user_id", userId)
      .gte("created_at", since);

    total = allLogs?.length ?? 0;
    successes = allLogs?.filter((l) => l.status_code >= 200 && l.status_code < 300).length ?? 0;

    const latencies = (allLogs ?? [])
      .filter((l) => l.response_time_ms != null)
      .map((l) => l.response_time_ms as number)
      .sort((a, b) => a - b);

    avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
    p99 = percentile(latencies, 99);
  }

  const { data: incidents } = await supabase
    .from("sla_incidents")
    .select("id, incident_type, endpoint, status_code, response_time_ms, message, resolved, created_at, resolved_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const errors = total - successes;
  const uptime = total > 0 ? Math.round((successes / total) * 10000) / 100 : 100;
  const unresolved = (incidents ?? []).filter((i) => !i.resolved).length;

  const result = {
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

  cacheSet(cacheKey, result, 30).catch(() => {});
  return result;
}
