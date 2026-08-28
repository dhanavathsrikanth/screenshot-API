-- 015: Job model — queue, priority, retry ceiling, request hash, lease fields
--
-- Chapter 3 Stage 3A: widen screenshot_jobs so the API can classify work
-- (queue name), honor plan-based priority, cap retries per job, deduplicate
-- by request hash, and later (Stage 3D) support lease-based crash recovery.
-- Existing status values are preserved for backward compatibility.

ALTER TABLE public.screenshot_jobs
  ADD COLUMN IF NOT EXISTS queue TEXT NOT NULL DEFAULT 'screenshot',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS request_hash TEXT,
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS leased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- Explicit status vocabulary; new rows must use one of these states.
ALTER TABLE public.screenshot_jobs
  ADD CONSTRAINT screenshot_jobs_status_check
  CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
  NOT VALID;
ALTER TABLE public.screenshot_jobs VALIDATE CONSTRAINT screenshot_jobs_status_check;

CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_queue_status ON public.screenshot_jobs(queue, status);
CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_request_hash ON public.screenshot_jobs(request_hash);
CREATE INDEX IF NOT EXISTS idx_screenshot_jobs_lease_expires ON public.screenshot_jobs(lease_expires_at);
