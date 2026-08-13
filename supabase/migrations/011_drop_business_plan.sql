-- 011: Drop the Business plan (plans are now Free / Starter / Pro only)
--
-- Business was removed from the app (plans.ts, checkout, webhooks, billing,
-- pricing UI). This migration purges the leftover DB rows:
--   1) plan_pricing.business row (feeds analytics cost + recommended plan)
--   2) any user_quotas rows still on 'business' -> downgrade to Pro with
--      Pro's monthly limit and capped credit balance.

DELETE FROM public.plan_pricing WHERE plan = 'business';

UPDATE public.user_quotas
SET
  plan = 'pro',
  monthly_limit = 15000,
  credits_granted_this_cycle = 15000,
  credit_balance = LEAST(COALESCE(credit_balance, 0), 15000),
  pending_plan = NULL
WHERE plan = 'business';
