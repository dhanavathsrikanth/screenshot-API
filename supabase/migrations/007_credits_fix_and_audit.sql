-- 007: Credit system fixes + per-request credit audit
--
-- 1) Fix adjust_credits so a deduction that spans monthly credit_balance and
--    top_up_balance is split correctly (previously over-deducted top-ups).
-- 2) Refill the Free plan's monthly grant when the cycle resets.
-- 3) Add try_deduct_credits: atomic check-and-deduct so concurrent requests
--    cannot over-spend credits.
-- 4) Add refund_credits for failed bulk renders.
-- 5) Add credits_used + source columns to api_key_logs for auditability
--    (playground vs API, and credits consumed per request).

-- ─────────────────────────────────────────────────────────────────────
-- 1) Fixed adjust_credits
-- ─────────────────────────────────────────────────────────────────────
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
#variable_conflict use_column
DECLARE
  v_free_limit INTEGER := 100;
  v_credit INTEGER;
  v_topup INTEGER;
  v_from_credit INTEGER;
  v_from_topup INTEGER;
BEGIN
  -- Reset monthly window if needed and refill the Free plan monthly grant
  UPDATE public.user_quotas
  SET
    monthly_used = CASE WHEN quota_reset_at <= now() THEN 0 ELSE monthly_used END,
    credits_used_this_cycle = CASE WHEN quota_reset_at <= now() THEN 0 ELSE credits_used_this_cycle END,
    credit_balance = CASE
      WHEN quota_reset_at <= now() AND plan = 'free' THEN v_free_limit
      ELSE credit_balance
    END,
    credits_granted_this_cycle = CASE
      WHEN quota_reset_at <= now() AND plan = 'free' THEN v_free_limit
      ELSE credits_granted_this_cycle
    END,
    quota_reset_at = CASE
      WHEN quota_reset_at <= now() THEN date_trunc('month', now()) + interval '1 month'
      ELSE quota_reset_at
    END
  WHERE user_id = p_user_id;

  IF p_delta >= 0 THEN
    UPDATE public.user_quotas
    SET credit_balance = credit_balance + p_delta,
        credits_granted_this_cycle = credits_granted_this_cycle + p_delta
    WHERE user_id = p_user_id;
  ELSE
    SELECT q.credit_balance, q.top_up_balance INTO v_credit, v_topup
    FROM public.user_quotas q WHERE q.user_id = p_user_id;

    v_from_credit := LEAST(v_credit, ABS(p_delta));
    v_from_topup := LEAST(v_topup, GREATEST(0, ABS(p_delta) - v_from_credit));

    UPDATE public.user_quotas
    SET
      credit_balance = v_credit - v_from_credit,
      top_up_balance = v_topup - v_from_topup,
      credits_used_this_cycle = credits_used_this_cycle + v_from_credit + v_from_topup
    WHERE user_id = p_user_id;
  END IF;

  RETURN QUERY
  SELECT u.credit_balance, u.top_up_balance, u.credits_used_this_cycle, u.credits_granted_this_cycle
  FROM public.user_quotas u WHERE u.user_id = p_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) Atomic check-and-deduct (race-safe)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.try_deduct_credits(p_user_id TEXT, p_amount INTEGER)
RETURNS TABLE (
  allowed BOOLEAN,
  credit_balance INTEGER,
  top_up_balance INTEGER,
  credits_used_this_cycle INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
DECLARE
  v_free_limit INTEGER := 100;
  v_credit INTEGER;
  v_topup INTEGER;
  v_from_credit INTEGER;
  v_from_topup INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT true, 0, 0, 0;
    RETURN;
  END IF;

  -- Reset monthly window if needed and refill the Free plan monthly grant
  UPDATE public.user_quotas
  SET
    monthly_used = CASE WHEN quota_reset_at <= now() THEN 0 ELSE monthly_used END,
    credits_used_this_cycle = CASE WHEN quota_reset_at <= now() THEN 0 ELSE credits_used_this_cycle END,
    credit_balance = CASE
      WHEN quota_reset_at <= now() AND plan = 'free' THEN v_free_limit
      ELSE credit_balance
    END,
    credits_granted_this_cycle = CASE
      WHEN quota_reset_at <= now() AND plan = 'free' THEN v_free_limit
      ELSE credits_granted_this_cycle
    END,
    quota_reset_at = CASE
      WHEN quota_reset_at <= now() THEN date_trunc('month', now()) + interval '1 month'
      ELSE quota_reset_at
    END
  WHERE user_id = p_user_id;

  SELECT q.credit_balance, q.top_up_balance INTO v_credit, v_topup
  FROM public.user_quotas q WHERE q.user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0;
    RETURN;
  END IF;

  v_from_credit := LEAST(v_credit, p_amount);
  v_from_topup := LEAST(v_topup, GREATEST(0, p_amount - v_from_credit));

  IF v_from_credit + v_from_topup < p_amount THEN
    RETURN QUERY SELECT false, v_credit, v_topup,
      (SELECT q2.credits_used_this_cycle FROM public.user_quotas q2 WHERE q2.user_id = p_user_id);
    RETURN;
  END IF;

  UPDATE public.user_quotas
  SET
    credit_balance = credit_balance - v_from_credit,
    top_up_balance = top_up_balance - v_from_topup,
    credits_used_this_cycle = credits_used_this_cycle + v_from_credit + v_from_topup
  WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT true, q.credit_balance, q.top_up_balance, q.credits_used_this_cycle
  FROM public.user_quotas q WHERE q.user_id = p_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 3) Refund credits (failed bulk renders, etc.)
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id TEXT, p_amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.user_quotas
  SET
    credit_balance = credit_balance + p_amount,
    credits_used_this_cycle = GREATEST(0, credits_used_this_cycle - p_amount)
  WHERE user_id = p_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4) Audit columns on api_key_logs
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.api_key_logs
  ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_api_key_logs_source ON public.api_key_logs(source);
CREATE INDEX IF NOT EXISTS idx_api_key_logs_credits ON public.api_key_logs(credits_used);
