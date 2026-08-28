-- 019: Retention enforcement, share links, per-key API key controls
--
--  1) api_keys.expires_at — optional expiry enforced by verify_api_key, which
--     now also returns rate_limit so callers can enforce per-key limits.
--  2) get_screenshot_history_stats(p_user_id) — SQL aggregate for the history
--     summary strip (replaces loading every row into JS).
--  3) screenshot_shares — expiring share-link tokens for individual captures.

-- 1) API key expiry + rate limit exposure -------------------------------------
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON public.api_keys(expires_at);

CREATE OR REPLACE FUNCTION public.verify_api_key(p_api_key TEXT)
RETURNS TABLE(valid BOOLEAN, api_key_id UUID, user_id TEXT, project_id UUID, error TEXT, rate_limit INTEGER)
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
    SELECT id, key_hash, user_id, project_id, rate_limit, expires_at, revoked_at
    FROM public.api_keys
    WHERE (key_prefix = v_prefix8 OR key_prefix = v_prefix7)
      AND is_active = true
  LOOP
    IF v_record.revoked_at IS NOT NULL THEN
      CONTINUE;
    END IF;
    IF v_record.expires_at IS NOT NULL AND v_record.expires_at <= now() THEN
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
      RETURN QUERY SELECT true, v_record.id, v_record.user_id, v_record.project_id, null::TEXT, v_record.rate_limit;
      RETURN;
    END IF;
  END LOOP;

  RETURN QUERY SELECT false, null::UUID, null::TEXT, null::UUID, 'Invalid API key'::TEXT, null::INTEGER;
END;
$$;

-- 2) History stats via SQL aggregates ------------------------------------------
CREATE OR REPLACE FUNCTION public.get_screenshot_history_stats(p_user_id TEXT)
RETURNS TABLE(total BIGINT, total_bytes BIGINT, via_api BIGINT, cached_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(file_size_bytes), 0)::BIGINT,
    COUNT(*) FILTER (WHERE metadata->>'method' IS NOT NULL)::BIGINT,
    COUNT(*) FILTER (WHERE cached)::BIGINT
  FROM public.screenshots
  WHERE user_id = p_user_id;
$$;

-- 3) Screenshot share links ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.screenshot_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  screenshot_id UUID NOT NULL REFERENCES public.screenshots(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.screenshot_shares ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_screenshot_shares_screenshot_id ON public.screenshot_shares(screenshot_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_shares_user_id ON public.screenshot_shares(user_id);

CREATE POLICY "Users view own screenshot shares"
  ON public.screenshot_shares FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users insert own screenshot shares"
  ON public.screenshot_shares FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users delete own screenshot shares"
  ON public.screenshot_shares FOR DELETE
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);
