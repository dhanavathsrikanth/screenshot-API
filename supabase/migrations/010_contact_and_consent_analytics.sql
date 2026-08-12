-- 010: Contact messages + consent event analytics
--
-- contact_messages stores submissions from the public /contact form. There is
-- no email provider wired up yet, so messages land in Supabase and are read by
-- the owner in /dashboard/admin.
--
-- consent_events records cookie-banner impressions/accepts/rejects so the
-- owner can review how the banner behaves. The banner calls POST /api/consent
-- (fire-and-forget) whenever a choice is made or a new banner is shown.

-- ── Contact messages ──────────────────────────────────────────────────────

CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_contact_messages_created_at
  ON public.contact_messages(created_at DESC);

-- Anyone may submit the contact form. Messages are only ever read through the
-- service-role-backed admin dashboard (see src/app/actions/admin.ts), so no
-- read policy exists for the anon/authenticated roles.
CREATE POLICY "Anyone can submit contact messages"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ── Consent events ────────────────────────────────────────────────────────

CREATE TABLE public.consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'accept', 'reject')),
  path TEXT,
  user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consent_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_consent_events_created_at
  ON public.consent_events(created_at DESC);

-- The banner records events from the public site; reads happen only through
-- the service-role-backed admin dashboard.
CREATE POLICY "Anyone can record consent events"
  ON public.consent_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (event_type IN ('impression', 'accept', 'reject'));
