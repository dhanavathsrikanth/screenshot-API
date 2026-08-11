-- 009: Track pending plan on checkout + post-payment reconciliation
--
-- The Dodo webhook is the only writer that upgrades user_quotas.plan today,
-- so a missed/failed webhook leaves a paying user on the Free plan. These
-- columns record what the user selected at checkout so the webhook has a
-- fallback when product resolution fails, and so the plan page can reconcile
-- the plan against the active Dodo subscription when the user returns from a
-- successful checkout (?upgraded=1).

ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS pending_plan TEXT;

ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS pending_product_id TEXT;
