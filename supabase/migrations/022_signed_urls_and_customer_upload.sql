-- 022: Signed GET URLs (per-key access_key + encrypted signing secret)
--      and per-project customer bucket destinations (S3 / R2 / GCS).

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS access_key TEXT,
  ADD COLUMN IF NOT EXISTS signing_secret_encrypted TEXT;

UPDATE public.api_keys
SET access_key = 'ak_' || replace(id::text, '-', '')
WHERE access_key IS NULL;

ALTER TABLE public.api_keys
  ALTER COLUMN access_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_access_key ON public.api_keys(access_key);

CREATE TABLE IF NOT EXISTS public.project_upload_destinations (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('s3', 'r2', 'gcs')),
  bucket TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'auto',
  endpoint TEXT,
  access_key_id TEXT NOT NULL,
  secret_encrypted TEXT NOT NULL,
  public_url_prefix TEXT,
  path_prefix TEXT NOT NULL DEFAULT 'screenshots',
  force_path_style BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  last_test_ok BOOLEAN,
  last_test_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_upload_destinations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_project_upload_destinations_user_id
  ON public.project_upload_destinations(user_id);

-- Policies are created only if missing so this migration is safe to re-run.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_upload_destinations'
      AND policyname = 'Users view own upload destinations'
  ) THEN
    CREATE POLICY "Users view own upload destinations"
      ON public.project_upload_destinations FOR SELECT
      USING ((select auth.jwt()->>'sub') = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_upload_destinations'
      AND policyname = 'Users insert own upload destinations'
  ) THEN
    CREATE POLICY "Users insert own upload destinations"
      ON public.project_upload_destinations FOR INSERT
      WITH CHECK ((select auth.jwt()->>'sub') = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_upload_destinations'
      AND policyname = 'Users update own upload destinations'
  ) THEN
    CREATE POLICY "Users update own upload destinations"
      ON public.project_upload_destinations FOR UPDATE
      USING ((select auth.jwt()->>'sub') = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_upload_destinations'
      AND policyname = 'Users delete own upload destinations'
  ) THEN
    CREATE POLICY "Users delete own upload destinations"
      ON public.project_upload_destinations FOR DELETE
      USING ((select auth.jwt()->>'sub') = user_id);
  END IF;
END $$;
