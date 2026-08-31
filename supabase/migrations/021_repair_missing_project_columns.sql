-- 021: Repair missing project_id / tracking columns (incomplete 013)
--
-- The production DB applied most of 013 (projects/usage_events/api_requests
-- tables) but the idempotent `ADD COLUMN` statements on the *existing* tables
-- were skipped, so current code that inserts `project_id` (saveScreenshot) or
-- selects `project_id`/`revoked_at` (verify_api_key) fails:
--   "column screenshots.project_id does not exist"
--
-- That surfacing: the playground/API render fine (uploads go through the
-- service role) but every `screenshots` INSERT silently fails, so /dashboard/history
-- is always empty. Re-running 013 wholesale would fail on the non-idempotent
-- CREATE POLICY statements, so we only re-apply the idempotent pieces here.
--
-- Safe to run at any time (IF NOT EXISTS / ON CONFLICT everywhere).

-- 1) Ensure the projects table + one default project per user exist ------------
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

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);

INSERT INTO public.projects (user_id, name, slug)
SELECT DISTINCT uq.user_id, 'Default Project', 'default-' || left(md5(uq.user_id), 10)
FROM (
  SELECT DISTINCT user_id FROM public.user_quotas
  UNION
  SELECT id FROM public.users
) uq
ON CONFLICT DO NOTHING;

-- 2) The missing project_id / tracking columns on existing tables ---------------
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

-- 3) Backfill project_id for the new columns ------------------------------------
UPDATE public.api_keys k SET project_id = p.id FROM public.projects p WHERE p.user_id = k.user_id AND k.project_id IS NULL;
UPDATE public.screenshots s SET project_id = p.id FROM public.projects p WHERE p.user_id = s.user_id AND s.project_id IS NULL;
UPDATE public.api_key_logs l SET project_id = p.id FROM public.projects p WHERE p.user_id = l.user_id AND l.project_id IS NULL;

-- 4) Indexes ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON public.api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_project_id ON public.screenshots(project_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_project_id ON public.screenshot_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_request_id ON public.screenshot_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_api_key_logs_project_id ON public.api_key_logs(project_id);

-- 5) Recreate verify_api_key against the (now complete) api_keys schema ----------
-- The previously-applied version predates project_id/revoked_at; silently
-- failing API-key auth would otherwise look like a credentials problem.
--
-- NOTE: this body is the 019 definition (8-char prefixes sk_live_/sk_test_ with a
-- legacy 7-char fallback, expires_at + revoked_at enforcement, rate_limit return),
-- which 021's original draft regressed to a 7-char-only match and dropped the
-- rate_limit column that src/lib/api-auth.ts reads back.
--
-- DROP first: the hand-applied 021 draft returned no rate_limit column, so a
-- plain CREATE OR REPLACE would fail with "cannot change return type".
DROP FUNCTION IF EXISTS public.verify_api_key(p_api_key TEXT);
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
