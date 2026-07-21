-- 005: Credit-based billing columns and Dodo customer mapping

-- 1) Map Dodo customer to our users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dodo_customer_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dodo_customer_id
  ON public.users(dodo_customer_id);

-- 2) Extend user_quotas with credit balances and settings
ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_used_this_cycle INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_granted_this_cycle INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_up_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS top_up_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overage_enabled BOOLEAN NOT NULL DEFAULT false;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON public.user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_topup_expiry ON public.user_quotas(top_up_expires_at);

-- 3) Initialize new credit columns on existing rows based on plan
DO $$
DECLARE
  r RECORD;
  base_limit INTEGER;
BEGIN
  FOR r IN SELECT user_id, plan FROM public.user_quotas LOOP
    base_limit := CASE r.plan
      WHEN 'free' THEN 100
      WHEN 'starter' THEN 2500
      WHEN 'pro' THEN 15000
      WHEN 'business' THEN 50000
      ELSE 100
    END;

    UPDATE public.user_quotas
    SET
      credit_balance = COALESCE(credit_balance, 0),
      credits_granted_this_cycle = COALESCE(credits_granted_this_cycle, 0),
      credits_used_this_cycle = COALESCE(credits_used_this_cycle, 0),
      top_up_balance = COALESCE(top_up_balance, 0),
      overage_enabled = COALESCE(overage_enabled, false)
    WHERE user_id = r.user_id;

    -- If new install, seed Free users with 100 monthly credits visibility
    UPDATE public.user_quotas
    SET
      credits_granted_this_cycle = CASE
        WHEN credits_granted_this_cycle = 0 THEN base_limit
        ELSE credits_granted_this_cycle
      END,
      credit_balance = CASE
        WHEN credit_balance = 0 AND monthly_used = 0 THEN base_limit
        ELSE credit_balance
      END
    WHERE user_id = r.user_id;
  END LOOP;
END
$$;

-- 4) Update handle_new_user trigger to seed credit fields on new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_limit INTEGER := 100;
BEGIN
  INSERT INTO public.user_quotas (
    user_id, plan, monthly_limit, monthly_used, quota_reset_at,
    credit_balance, credits_used_this_cycle, credits_granted_this_cycle, top_up_balance, overage_enabled
  )
  VALUES (
    NEW.id, 'free', base_limit, 0, date_trunc('month', now()) + interval '1 month',
    base_limit, 0, base_limit, 0, false
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Recreate trigger to ensure it points to the latest function body
DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5) Utility function to adjust credits atomically (positive=grant, negative=deduct)
CREATE OR REPLACE FUNCTION public.adjust_credits(p_user_id TEXT, p_delta INTEGER)
RETURNS TABLE (
  credit_balance INTEGER,
  top_up_balance INTEGER,
  credits_used_this_cycle INTEGER,
  credits_granted_this_cycle INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credit INTEGER;
  v_topup INTEGER;
BEGIN
  -- Reset monthly window if needed
  UPDATE public.user_quotas
  SET
    monthly_used = CASE WHEN quota_reset_at <= now() THEN 0 ELSE monthly_used END,
    credits_used_this_cycle = CASE WHEN quota_reset_at <= now() THEN 0 ELSE credits_used_this_cycle END,
    credits_granted_this_cycle = CASE WHEN quota_reset_at <= now() THEN credits_granted_this_cycle ELSE credits_granted_this_cycle END,
    quota_reset_at = CASE WHEN quota_reset_at <= now() THEN date_trunc('month', now()) + interval '1 month' ELSE quota_reset_at END
  WHERE user_id = p_user_id;

  -- Apply delta to monthly credits first, then top-up if delta is negative
  IF p_delta >= 0 THEN
    UPDATE public.user_quotas
    SET credit_balance = credit_balance + p_delta,
        credits_granted_this_cycle = credits_granted_this_cycle + p_delta
    WHERE user_id = p_user_id;
  ELSE
    -- Deduct path
    -- Try deduct from monthly credit_balance
    UPDATE public.user_quotas
    SET
      credits_used_this_cycle = credits_used_this_cycle + LEAST(credit_balance, ABS(p_delta)),
      credit_balance = GREATEST(0, credit_balance + p_delta)
    WHERE user_id = p_user_id;

    -- If still negative amount remains, deduct remainder from top_up_balance
    SELECT credit_balance INTO v_credit FROM public.user_quotas WHERE user_id = p_user_id;
    IF v_credit = 0 THEN
      UPDATE public.user_quotas
      SET
        top_up_balance = GREATEST(0, top_up_balance + (p_delta + v_credit)), -- v_credit is 0 or positive, so p_delta is still negative
        credits_used_this_cycle = credits_used_this_cycle + GREATEST(0, LEAST(top_up_balance, ABS(p_delta)))
      WHERE user_id = p_user_id;
    END IF;
  END IF;

  RETURN QUERY
  SELECT credit_balance, top_up_balance, credits_used_this_cycle, credits_granted_this_cycle
  FROM public.user_quotas
  WHERE user_id = p_user_id;
END;
$$;

-- 6) Optional: helper to toggle overage on paid plans
CREATE OR REPLACE FUNCTION public.set_overage(p_user_id TEXT, p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_quotas
  SET overage_enabled = p_enabled
  WHERE user_id = p_user_id;
END;
$$;