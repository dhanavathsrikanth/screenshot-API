-- Run this in Supabase SQL Editor if 022 failed partway through (duplicate policy error).
-- Safe to run multiple times.

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
