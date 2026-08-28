-- 016: Widen api_keys.key_prefix to fit the current 8-char prefix format
--
-- Migration 014 taught verify_api_key() to match 8-char prefixes
-- (sk_live_/sk_test_) but never widened the underlying column, which was
-- still VARCHAR(7) from 001_initial_schema.sql. Postgres enforces VARCHAR(n)
-- as a hard length limit (it does not truncate), so every new key created
-- via newApiKeyPair() (src/lib/api-keys.ts, 8-char prefixes) has been
-- failing to insert with "value too long for type character varying(7)".

ALTER TABLE public.api_keys
  ALTER COLUMN key_prefix TYPE VARCHAR(8);
