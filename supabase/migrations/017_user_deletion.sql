-- 017: Track Clerk account deletions and stop orphaned API keys from working
--
-- The Clerk webhook previously only handled user.created/user.updated, so a
-- deleted Clerk account left its `users` row and (critically) its API keys
-- untouched -- a deleted account's API keys kept authenticating forever.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
