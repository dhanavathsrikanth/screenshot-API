-- 012: Job-based v1 screenshot API
--
-- Persists async screenshot jobs so clients can poll GET /api/v1/screenshots/:id
-- while a render runs in the background, and so crashes can be recovered.

CREATE TABLE IF NOT EXISTS public.screenshot_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  api_key_id TEXT,
  source TEXT NOT NULL DEFAULT 'api',
  status TEXT NOT NULL DEFAULT 'processing',
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  screenshot_id TEXT,
  storage_url TEXT,
  format TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  cached BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_user_id ON public.screenshot_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_status ON public.screenshot_jobs(status);
