-- 016: Add the Scale plan ($79/mo, 50,000 renders)
--
-- Scale is the video/GIF + streaming capture tier (geo-targeting is already
-- included in Pro). user_quotas.plan is a free-form TEXT column with no CHECK
-- constraint, so no table changes are needed — this only seeds the analytics
-- pricing config that feeds cost estimation and the recommended-plan logic.

INSERT INTO public.plan_pricing (plan, monthly_price_usd, monthly_limit, per_screenshot_cost_usd, storage_cost_per_gb_usd, bandwidth_cost_per_gb_usd)
VALUES ('scale', 79, 50000, 0.0025, 0.012, 0.007)
ON CONFLICT (plan) DO UPDATE SET
  monthly_price_usd = EXCLUDED.monthly_price_usd,
  monthly_limit = EXCLUDED.monthly_limit,
  per_screenshot_cost_usd = EXCLUDED.per_screenshot_cost_usd,
  storage_cost_per_gb_usd = EXCLUDED.storage_cost_per_gb_usd,
  bandwidth_cost_per_gb_usd = EXCLUDED.bandwidth_cost_per_gb_usd;
