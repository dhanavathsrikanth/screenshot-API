-- 014: Outbound webhooks + durable job retries + sk_live_/sk_test_ keys
--
--  1) verify_api_key now matches 8-char prefixes (sk_live_/sk_test_) while
--     keeping legacy 7-char prefixes (st_xxxxx) working.
--  2) webhook_endpoints / webhook_deliveries tables for signed outbound
--     webhook delivery with retries and a delivery log.
--  3) screenshot_jobs gains attempts / next_attempt_at / last_error so the
--     worker can retry transient render failures with backoff.

-- 1) API key verification: 8-char first, legacy 7-char fallback ----------------
CREATE OR REPLACE FUNCTION public.verify_api_key(p_api_key TEXT)
RETURNS TABLE(valid BOOLEAN, api_key_id UUID, user_id TEXT, project_id UUID, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix8 TEXT;
  v_prefix7 TEXT;
  v_record RECORD;
  v_salt TEXT;
  v_hash TEXT;
  v_computed_hash TEXT;
BEGIN
  v_prefix8 := left(p_api_key, 8);
  v_prefix7 := left(p_api_key, 7);

  FOR v_record IN
    SELECT id, key_hash, user_id, project_id, is_active, revoked_at
    FROM public.api_keys
    WHERE (key_prefix = v_prefix8 OR key_prefix = v_prefix7)
      AND is_active = true
  LOOP
    IF v_record.revoked_at IS NOT NULL THEN
      CONTINUE;
    END IF;
    v_salt := split_part(v_record.key_hash, ':', 1);
    v_hash := split_part(v_record.key_hash, ':', 2);
    v_computed_hash := encode(
      digest(v_salt || p_api_key, 'sha256'),
      'hex'
    );
    IF v_computed_hash = v_hash THEN
      UPDATE public.api_keys SET last_used_at = now() WHERE id = v_record.id;
      RETURN QUERY SELECT true, v_record.id, v_record.user_id, v_record.project_id, null::TEXT;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT false, null::UUID, null::TEXT, null::UUID, 'Invalid API key'::TEXT;
END;
$$;

-- 2) Webhook endpoints -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '["screenshot.completed","screenshot.failed"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_user_id ON public.webhook_endpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_project_id ON public.webhook_endpoints(project_id);

CREATE POLICY "Users view own webhook endpoints"
  ON public.webhook_endpoints FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users insert own webhook endpoints"
  ON public.webhook_endpoints FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users update own webhook endpoints"
  ON public.webhook_endpoints FOR UPDATE
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users delete own webhook endpoints"
  ON public.webhook_endpoints FOR DELETE
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- 3) Webhook deliveries ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  http_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status_retry ON public.webhook_deliveries(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_id ON public.webhook_deliveries(endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_user_id ON public.webhook_deliveries(user_id);

CREATE POLICY "Users view own webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- 4) Durable job retries ---------------------------------------------------------
ALTER TABLE public.screenshot_jobs
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;
