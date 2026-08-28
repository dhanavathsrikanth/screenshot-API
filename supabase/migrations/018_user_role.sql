-- 018: DB-backed admin role
--
-- Admin access moves from env-var email lists to a role column on users,
-- so admins can be granted/revoked at runtime (and later from the admin UI
-- itself) without a redeploy. ADMIN_EMAILS / ADMIN_USER_IDS env vars remain
-- supported purely as a bootstrap/fallback so the operator can always
-- promote the first admin even before any row has role='admin'.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role) WHERE role <> 'user';

COMMENT ON COLUMN public.users.role IS
  'Access role: ''user'' (default) or ''admin''. Checked by isAdminUser(); env vars are a bootstrap fallback.';
