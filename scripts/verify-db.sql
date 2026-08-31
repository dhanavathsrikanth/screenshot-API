-- Run in Supabase SQL Editor before launch.
-- Each query should return rows only when something is MISSING.
-- Empty result = that check passed.

-- 1. Project columns on core tables
SELECT 'missing_column' AS issue, 'screenshots.project_id' AS detail
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'screenshots' AND column_name = 'project_id'
)
UNION ALL
SELECT 'missing_column', 'api_keys.project_id'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'project_id'
)
UNION ALL
SELECT 'missing_column', 'api_key_logs.project_id'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'api_key_logs' AND column_name = 'project_id'
);

-- 2. Signed URL columns on api_keys (migration 022)
SELECT 'missing_column' AS issue, 'api_keys.access_key' AS detail
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'access_key'
)
UNION ALL
SELECT 'missing_column', 'api_keys.signing_secret_encrypted'
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'signing_secret_encrypted'
);

-- 3. Customer upload destinations table (migration 022)
SELECT 'missing_table' AS issue, 'project_upload_destinations' AS detail
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'project_upload_destinations'
);

-- 4. Analytics RPCs (migration 008) — optional but dashboard charts degrade without them
SELECT 'missing_function' AS issue, 'analytics_daily_usage' AS detail
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'analytics_daily_usage'
);
