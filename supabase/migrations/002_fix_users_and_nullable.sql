-- ============================================
-- Fix: Add users table, make columns nullable
-- ============================================

-- 1. Create users table (synced from Clerk webhooks)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING ((select auth.jwt()->>'sub') = id);

-- 2. Make api_key_logs.api_key_id nullable (dashboard calls have no API key)
ALTER TABLE public.api_key_logs
  DROP CONSTRAINT IF EXISTS api_key_logs_api_key_id_fkey;

ALTER TABLE public.api_key_logs
  ALTER COLUMN api_key_id DROP NOT NULL;

ALTER TABLE public.api_key_logs
  ADD CONSTRAINT api_key_logs_api_key_id_fkey
  FOREIGN KEY (api_key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;

-- 3. Make screenshots.url nullable (saveScreenshot uses storage_url)
ALTER TABLE public.screenshots
  ALTER COLUMN url DROP NOT NULL;

-- 4. Auto-create user_quotas row when user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_quotas (user_id, plan, monthly_limit, monthly_used)
  VALUES (NEW.id, 'free', 100, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created ON public.users;

CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
