-- 006: Webhook events log + credit grants on payment

-- 1) Webhook events log table (idempotency + debugging)
CREATE TABLE IF NOT EXISTS public.dodo_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  dodo_event_id TEXT,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'processed'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dodo_webhook_events_dodo_id
  ON public.dodo_webhook_events(dodo_event_id)
  WHERE dodo_event_id IS NOT NULL;

-- 2) Add dodo_subscription_id to user_quotas for tracking active subs
ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS dodo_subscription_id TEXT;

-- 3) Add dodo_product_id to user_quotas for plan mapping
ALTER TABLE public.user_quotas
  ADD COLUMN IF NOT EXISTS dodo_product_id TEXT;
