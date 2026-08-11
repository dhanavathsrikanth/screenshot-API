-- 008: Dashboard performance — composite indexes + server-side aggregation
-- ============================================================================
-- The dashboard renders by running many queries against api_key_logs and
-- screenshots filtered by (user_id, created_at) and then aggregating every
-- returned row in the serverless function. As those tables grow, shipping
-- thousands/millions of rows to Vercel is what makes dashboard pages crawl.
--
-- This migration:
--   1) Adds composite (user_id, created_at) indexes so those range scans are
--      index-only.
--   2) Adds SQL RPC functions that aggregate inside Postgres and return only
--      the (~30) rows the charts need. The dashboard calls them via
--      supabase.rpc() and falls back to the old logic if they are missing.

-- ─── 1) Composite indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_api_key_logs_user_created
  ON public.api_key_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_screenshots_user_created
  ON public.screenshots(user_id, created_at DESC);

-- ─── 2) Server-side analytics aggregation ─────────────────────────────

-- Daily request counts (client fills zero-days for the chart).
CREATE OR REPLACE FUNCTION public.analytics_daily_usage(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(date_key TEXT, count INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date_key, COUNT(*)::INTEGER AS count
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
  GROUP BY 1
  ORDER BY 1;
$$;

-- Daily latency percentiles.
CREATE OR REPLACE FUNCTION public.analytics_latency_stats(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(date_key TEXT, avg INTEGER, p50 INTEGER, p95 INTEGER, p99 INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date_key,
    COALESCE(ROUND(AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL)), 0)::INTEGER AS avg,
    COALESCE(ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY response_time_ms)), 0)::INTEGER AS p50,
    COALESCE(ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms)), 0)::INTEGER AS p95,
    COALESCE(ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms)), 0)::INTEGER AS p99
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
    AND response_time_ms IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

-- Peak-hour heatmap (dow 0=Sunday..6=Saturday, hour 0..23, both UTC).
CREATE OR REPLACE FUNCTION public.analytics_peak_hours(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(dow INTEGER, hour INTEGER, count INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT EXTRACT(DOW FROM created_at AT TIME ZONE 'UTC')::INTEGER AS dow,
    EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::INTEGER AS hour,
    COUNT(*)::INTEGER AS count
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
  GROUP BY 1, 2;
$$;

-- Endpoint breakdown.
CREATE OR REPLACE FUNCTION public.analytics_endpoint_breakdown(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(name TEXT, value INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT CASE endpoint
      WHEN '/api/take' THEN 'Single'
      WHEN '/api/take/bulk' THEN 'Bulk'
      ELSE endpoint
    END AS name,
    COUNT(*)::INTEGER AS value
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
  GROUP BY 1
  ORDER BY value DESC;
$$;

-- Method breakdown.
CREATE OR REPLACE FUNCTION public.analytics_method_breakdown(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(name TEXT, value INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT method AS name, COUNT(*)::INTEGER AS value
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
  GROUP BY 1
  ORDER BY value DESC;
$$;

-- Format distribution (from screenshots).
CREATE OR REPLACE FUNCTION public.analytics_format_distribution(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(name TEXT, value INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT UPPER(format) AS name, COUNT(*)::INTEGER AS value
  FROM public.screenshots
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
  GROUP BY 1
  ORDER BY value DESC;
$$;

-- Status code buckets.
CREATE OR REPLACE FUNCTION public.analytics_status_breakdown(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(name TEXT, value INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
      WHEN status_code >= 200 AND status_code < 300 THEN '2xx'
      WHEN status_code >= 400 AND status_code < 500 THEN '4xx'
      WHEN status_code >= 500 THEN '5xx'
      ELSE status_code::TEXT
    END AS name,
    COUNT(*)::INTEGER AS value
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
  GROUP BY 1
  ORDER BY value DESC;
$$;

-- Cache hit/miss trend.
CREATE OR REPLACE FUNCTION public.analytics_cache_trend(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(date_key TEXT, total INTEGER, cached INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date_key,
    COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE cached)::INTEGER AS cached
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
  GROUP BY 1
  ORDER BY 1;
$$;

-- Bandwidth usage (sum of screenshot bytes per day).
CREATE OR REPLACE FUNCTION public.analytics_bandwidth(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(date_key TEXT, bytes BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date_key,
    COALESCE(SUM(file_size_bytes), 0)::BIGINT AS bytes
  FROM public.screenshots
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
    AND file_size_bytes IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

-- SLA aggregate stats.
CREATE OR REPLACE FUNCTION public.analytics_sla_stats(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(total INTEGER, successes INTEGER, errors INTEGER, avg_latency INTEGER, p99_latency INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::INTEGER AS total,
    COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::INTEGER AS successes,
    COUNT(*)::INTEGER - COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300)::INTEGER AS errors,
    COALESCE(ROUND(AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL)), 0)::INTEGER AS avg_latency,
    COALESCE(ROUND(percentile_cont(0.99) WITHIN GROUP (ORDER BY response_time_ms)), 0)::INTEGER AS p99_latency
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days));
$$;

-- Per-key usage stats.
CREATE OR REPLACE FUNCTION public.analytics_key_usage(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(api_key_id UUID, calls INTEGER, errors INTEGER, avg_latency INTEGER, p95_latency INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT
    api_key_id,
    COUNT(*)::INTEGER AS calls,
    COUNT(*) FILTER (WHERE status_code IS NOT NULL AND status_code >= 400)::INTEGER AS errors,
    COALESCE(ROUND(AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL)), 0)::INTEGER AS avg_latency,
    COALESCE(ROUND(percentile_cont(0.95) WITHIN GROUP (ORDER BY response_time_ms)), 0)::INTEGER AS p95_latency
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days))
    AND api_key_id IS NOT NULL
  GROUP BY api_key_id;
$$;

-- Week-over-week / month-over-month totals (one scan instead of four).
CREATE OR REPLACE FUNCTION public.analytics_period_comparison(p_user_id TEXT)
RETURNS TABLE(this_week INTEGER, last_week INTEGER, this_month INTEGER, last_month INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::INTEGER AS this_week,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days')::INTEGER AS last_week,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::INTEGER AS this_month,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '60 days' AND created_at < now() - interval '30 days')::INTEGER AS last_month
  FROM public.api_key_logs
  WHERE user_id = p_user_id;
$$;

-- Total calls + cache hits in a window (used by the overview page).
CREATE OR REPLACE FUNCTION public.analytics_count_stats(p_user_id TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE(total INTEGER, cached INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER AS total, COUNT(*) FILTER (WHERE cached)::INTEGER AS cached
  FROM public.api_key_logs
  WHERE user_id = p_user_id
    AND created_at >= (now() - make_interval(days => p_days));
$$;

-- ─── 3) Grant execution to the authenticated role ─────────────────────
GRANT EXECUTE ON FUNCTION
  public.analytics_daily_usage(TEXT, INTEGER),
  public.analytics_latency_stats(TEXT, INTEGER),
  public.analytics_peak_hours(TEXT, INTEGER),
  public.analytics_endpoint_breakdown(TEXT, INTEGER),
  public.analytics_method_breakdown(TEXT, INTEGER),
  public.analytics_format_distribution(TEXT, INTEGER),
  public.analytics_status_breakdown(TEXT, INTEGER),
  public.analytics_cache_trend(TEXT, INTEGER),
  public.analytics_bandwidth(TEXT, INTEGER),
  public.analytics_sla_stats(TEXT, INTEGER),
  public.analytics_key_usage(TEXT, INTEGER),
  public.analytics_count_stats(TEXT, INTEGER)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.analytics_period_comparison(TEXT) TO authenticated;
