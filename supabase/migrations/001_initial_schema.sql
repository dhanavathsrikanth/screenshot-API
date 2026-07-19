-- ============================================
-- ScreenTool Database Schema
-- Clerk user IDs (sub claim) used as user_id
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. User Quotas (tracks plan + monthly usage)
-- ============================================
CREATE TABLE public.user_quotas (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  monthly_limit INTEGER NOT NULL DEFAULT 100,
  monthly_used INTEGER NOT NULL DEFAULT 0,
  quota_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own quota"
  ON public.user_quotas FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- ============================================
-- 2. Screenshots (history of rendered screenshots)
-- ============================================
CREATE TABLE public.screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  api_key_id UUID,
  url TEXT NOT NULL,
  storage_url TEXT,
  format TEXT NOT NULL DEFAULT 'png',
  width INTEGER NOT NULL DEFAULT 1280,
  height INTEGER NOT NULL DEFAULT 720,
  file_size_bytes INTEGER,
  cached BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX idx_screenshots_created_at ON public.screenshots(created_at DESC);

CREATE POLICY "Users view own screenshots"
  ON public.screenshots FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users insert own screenshots"
  ON public.screenshots FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users delete own screenshots"
  ON public.screenshots FOR DELETE
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- ============================================
-- 3. API Keys (hashed, prefix-based lookup)
-- ============================================
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_prefix VARCHAR(7) NOT NULL,
  key_hash TEXT NOT NULL,
  rate_limit INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);

CREATE POLICY "Users view own API keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users insert own API keys"
  ON public.api_keys FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users delete own API keys"
  ON public.api_keys FOR DELETE
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- ============================================
-- 4. API Key Logs (request logging for usage tracking)
-- ============================================
CREATE TABLE public.api_key_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  screenshot_url TEXT,
  cached BOOLEAN NOT NULL DEFAULT false,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_key_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_api_key_logs_api_key_id ON public.api_key_logs(api_key_id);
CREATE INDEX idx_api_key_logs_created_at ON public.api_key_logs(created_at DESC);
CREATE INDEX idx_api_key_logs_user_id ON public.api_key_logs(user_id);

CREATE POLICY "Users view own API logs"
  ON public.api_key_logs FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- ============================================
-- 5. Helper function: verify API key (for middleware)
-- ============================================
CREATE OR REPLACE FUNCTION public.verify_api_key(p_api_key TEXT)
RETURNS TABLE(valid BOOLEAN, api_key_id UUID, user_id TEXT, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix TEXT;
  v_record RECORD;
  v_salt TEXT;
  v_hash TEXT;
  v_computed_hash TEXT;
BEGIN
  v_prefix := substring(p_api_key, 1, 7);

  FOR v_record IN
    SELECT id, key_hash, user_id, is_active
    FROM public.api_keys
    WHERE key_prefix = v_prefix
      AND is_active = true
  LOOP
    v_salt := split_part(v_record.key_hash, ':', 1);
    v_hash := split_part(v_record.key_hash, ':', 2);
    v_computed_hash := encode(
      digest(v_salt || p_api_key, 'sha256'),
      'hex'
    );
    IF v_computed_hash = v_hash THEN
      UPDATE public.api_keys SET last_used_at = now() WHERE id = v_record.id;
      RETURN QUERY SELECT true, v_record.id, v_record.user_id, null::TEXT;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT false, null::UUID, null::TEXT, 'Invalid API key'::TEXT;
END;
$$;

-- ============================================
-- 6. Helper function: increment monthly usage
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id TEXT, p_amount INTEGER DEFAULT 1)
RETURNS TABLE(monthly_used INTEGER, monthly_limit INTEGER, plan TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_quotas (user_id, monthly_used, quota_reset_at)
  VALUES (p_user_id, p_amount, date_trunc('month', now()) + interval '1 month')
  ON CONFLICT (user_id) DO UPDATE SET
    monthly_used = CASE
      WHEN public.user_quotas.quota_reset_at <= now() THEN p_amount
      ELSE public.user_quotas.monthly_used + p_amount
    END,
    quota_reset_at = CASE
      WHEN public.user_quotas.quota_reset_at <= now() THEN date_trunc('month', now()) + interval '1 month'
      ELSE public.user_quotas.quota_reset_at
    END;

  RETURN QUERY SELECT u.monthly_used, u.monthly_limit, u.plan
  FROM public.user_quotas u WHERE u.user_id = p_user_id;
END;
$$;
