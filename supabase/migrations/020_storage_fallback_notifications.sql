-- 020: Storage fallback alerts + Supabase Storage bucket
--
-- Screenshots are primarily stored on Cloudflare R2. When an R2 upload fails,
-- the render path falls back to a Supabase Storage bucket so the capture is
-- never lost. That fallback also records an alert in admin_notifications so
-- the owner can see exactly when/why it happened (with the original R2 error).

-- ── Supabase Storage bucket (public read; used as the R2 fallback) ───────
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Public read so preview/thumbnail URLs resolve without auth. Writes happen
-- only via the service role during render, which bypasses RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read object (screenshots)'
  ) THEN
    CREATE POLICY "Public read object (screenshots)"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'screenshots');
  END IF;
END $$;

-- ── Admin notifications ──────────────────────────────────────────────────
-- Internal operational alerts (e.g. storage fallback) surfaced to the owner
-- in /dashboard/admin. Written and read exclusively through the service role,
-- so there are no anon/authenticated policies.

CREATE TABLE public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'storage',
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  metadata JSONB DEFAULT '{}',
  user_id TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_admin_notifications_created_at
  ON public.admin_notifications(created_at DESC);

CREATE INDEX idx_admin_notifications_type
  ON public.admin_notifications(type);
