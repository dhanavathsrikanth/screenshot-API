-- 013: Multi-tenant projects + usage_events + api_requests + request tracking
--
-- Adds the blueprint's entity model on top of the existing flat schema:
--   users (exists) → projects → api_keys / screenshots / usage_events / api_requests
-- Also adds request_id tracking to screenshot_jobs and environment/revoked_at to api_keys.

-- 1) projects ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Project',
  slug TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  monthly_limit INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);

CREATE POLICY "Users view own projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users insert own projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt()->>'sub') = user_id);

CREATE POLICY "Users update own projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- Backfill one default project per existing user (from user_quotas + users).
INSERT INTO public.projects (user_id, name, slug)
SELECT uq.user_id, 'Default Project', 'default-' || left(md5(uq.user_id), 10)
FROM (
  SELECT DISTINCT user_id FROM public.user_quotas
  UNION
  SELECT id FROM public.users
) uq
ON CONFLICT DO NOTHING;

-- 2) project_id + tracking columns on existing tables ---------------------------
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE public.screenshots
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.screenshot_jobs
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

ALTER TABLE public.api_key_logs
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

UPDATE public.api_keys k SET project_id = p.id FROM public.projects p WHERE p.user_id = k.user_id AND k.project_id IS NULL;
UPDATE public.screenshots s SET project_id = p.id FROM public.projects p WHERE p.user_id = s.user_id AND s.project_id IS NULL;
UPDATE public.api_key_logs l SET project_id = p.id FROM public.projects p WHERE p.user_id = l.user_id AND l.project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON public.api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_project_id ON public.screenshots(project_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_project_id ON public.screenshot_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_request_id ON public.screenshot_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_api_key_logs_project_id ON public.api_key_logs(project_id);

-- 3) usage_events (billing/metadata foundation) ---------------------------------
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  api_key_id UUID,
  screenshot_id TEXT,
  event_type TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_project_id ON public.usage_events(project_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON public.usage_events(created_at DESC);

CREATE POLICY "Users view own usage events"
  ON public.usage_events FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- 4) api_requests (per-request trace log for debugging customer issues) ---------
CREATE TABLE IF NOT EXISTS public.api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  api_key_id UUID,
  request_id TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  latency_ms INTEGER,
  ip_hash TEXT,
  user_agent TEXT,
  cached BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_api_requests_user_id ON public.api_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_project_id ON public.api_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_request_id ON public.api_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON public.api_requests(created_at DESC);

CREATE POLICY "Users view own api requests"
  ON public.api_requests FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = user_id);

-- 5) API key verification now also returns project_id ---------------------------
CREATE OR REPLACE FUNCTION public.verify_api_key(p_api_key TEXT)
RETURNS TABLE(valid BOOLEAN, api_key_id UUID, user_id TEXT, project_id UUID, error TEXT)
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
    SELECT id, key_hash, user_id, project_id, is_active, revoked_at
    FROM public.api_keys
    WHERE key_prefix = v_prefix
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
