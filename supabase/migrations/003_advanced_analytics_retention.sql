-- ============================================
-- 003: Advanced analytics, retention
-- ============================================

-- 1. Cost tracking per API call
ALTER TABLE public.api_key_logs
  ADD COLUMN IF NOT EXISTS compute_ms INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_bytes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10, 6) DEFAULT 0;

-- 2. Usage alerts
CREATE TABLE IF NOT EXISTS public.usage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  threshold_pct INTEGER NOT NULL DEFAULT 80,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.usage_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own alerts" ON public.usage_alerts FOR SELECT TO authenticated USING ((select auth.jwt()->>'sub') = user_id);

-- 3. SLA tracking
CREATE TABLE IF NOT EXISTS public.sla_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  endpoint TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  message TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.sla_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own incidents" ON public.sla_incidents FOR SELECT TO authenticated USING ((select auth.jwt()->>'sub') = user_id);

CREATE INDEX IF NOT EXISTS idx_sla_incidents_user ON public.sla_incidents(user_id, created_at DESC);

-- 4. Email digest preferences
CREATE TABLE IF NOT EXISTS public.digest_preferences (
  user_id TEXT PRIMARY KEY,
  weekly_digest BOOLEAN NOT NULL DEFAULT true,
  alert_threshold_pct INTEGER NOT NULL DEFAULT 80,
  last_digest_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.digest_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON public.digest_preferences FOR ALL TO authenticated USING ((select auth.jwt()->>'sub') = user_id);

-- 5. Plan pricing config (for cost estimation)
CREATE TABLE IF NOT EXISTS public.plan_pricing (
  plan TEXT PRIMARY KEY,
  monthly_price_usd NUMERIC(10, 2) NOT NULL,
  monthly_limit INTEGER NOT NULL,
  per_screenshot_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  storage_cost_per_gb_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.02,
  bandwidth_cost_per_gb_usd NUMERIC(10, 4) NOT NULL DEFAULT 0.01
);

INSERT INTO public.plan_pricing (plan, monthly_price_usd, monthly_limit, per_screenshot_cost_usd, storage_cost_per_gb_usd, bandwidth_cost_per_gb_usd)
VALUES
  ('free', 0, 100, 0, 0, 0),
  ('starter', 9, 2500, 0.004, 0.02, 0.01),
  ('pro', 49, 15000, 0.003, 0.015, 0.008),
  ('business', 149, 50000, 0.002, 0.01, 0.005)
ON CONFLICT (plan) DO UPDATE SET
  monthly_price_usd = EXCLUDED.monthly_price_usd,
  monthly_limit = EXCLUDED.monthly_limit,
  per_screenshot_cost_usd = EXCLUDED.per_screenshot_cost_usd;

-- 6. Function: detect SLA breaches
CREATE OR REPLACE FUNCTION public.check_sla_breach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.response_time_ms > 5000 THEN
    INSERT INTO public.sla_incidents (user_id, incident_type, endpoint, status_code, response_time_ms, message)
    VALUES (NEW.user_id, 'slow_response', NEW.endpoint, NEW.status_code, NEW.response_time_ms,
      'Response time exceeded 5s SLA threshold');
  ELSIF NEW.status_code >= 500 THEN
    INSERT INTO public.sla_incidents (user_id, incident_type, endpoint, status_code, response_time_ms, message)
    VALUES (NEW.user_id, 'server_error', NEW.endpoint, NEW.status_code, NEW.response_time_ms,
      'Server error detected');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_sla_on_log ON public.api_key_logs;
CREATE TRIGGER check_sla_on_log
  AFTER INSERT ON public.api_key_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_sla_breach();

-- 7. Function: auto-generate usage alerts
CREATE OR REPLACE FUNCTION public.check_usage_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit INTEGER;
  v_pct INTEGER;
BEGIN
  SELECT monthly_limit INTO v_limit FROM public.user_quotas WHERE user_id = NEW.user_id;
  IF v_limit IS NULL OR v_limit = 0 THEN RETURN NEW; END IF;

  v_pct := (NEW.monthly_used * 100) / v_limit;

  IF v_pct >= 80 AND NOT EXISTS (
    SELECT 1 FROM public.usage_alerts
    WHERE user_id = NEW.user_id AND alert_type = 'quota_warning'
      AND triggered_at > date_trunc('month', now())
  ) THEN
    INSERT INTO public.usage_alerts (user_id, alert_type, threshold_pct)
    VALUES (NEW.user_id, 'quota_warning', v_pct);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_usage_on_quota ON public.user_quotas;
CREATE TRIGGER check_usage_on_quota
  AFTER UPDATE OF monthly_used ON public.user_quotas
  FOR EACH ROW
  EXECUTE FUNCTION public.check_usage_alert();
