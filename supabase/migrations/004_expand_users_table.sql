-- Expand users table to store full Clerk webhook payload
-- Run this migration in Supabase SQL Editor

-- Add new columns for full Clerk user data
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS has_image BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locale TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS primary_email_address_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_numbers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS external_accounts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS public_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS private_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS unsafe_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS backup_code_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS raw_json JSONB;

-- Add UPDATE policy so users can update their own profile
CREATE POLICY IF NOT EXISTS "Users update own profile"
  ON public.users FOR UPDATE
  USING (auth.jwt()->>'sub' = id)
  WITH CHECK (auth.jwt()->>'sub' = id);

-- Create index for faster lookups on external_accounts (Google ID)
CREATE INDEX IF NOT EXISTS idx_users_external_accounts ON public.users USING GIN (external_accounts);
