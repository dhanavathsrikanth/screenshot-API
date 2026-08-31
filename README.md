This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploying to Render

This app is deployed on [Render](https://render.com) as a single persistent Node.js web service — **not** Vercel or another serverless platform. That's an intentional choice: the screenshot renderer needs a long-lived Chromium process and the BullMQ job worker runs in-process alongside the web server (see `src/lib/jobs.ts`), both of which need a process that stays warm between requests.

1. Push this repo to Git and create a new **Blueprint** in the Render Dashboard pointing at it — Render will read [`render.yaml`](./render.yaml) and provision the web service plus a Key Value (Redis-compatible) instance for the job queue.
2. In the service's **Environment** tab, fill in every variable marked `sync: false` in `render.yaml` (Supabase, Clerk, R2, Upstash, Dodo Payments, Sentry, PostHog secrets/keys — none of these are committed to the repo).
3. Render builds with `npm install && npm run build` and starts with `npm start` (`next start`, which binds to Render's `$PORT` automatically). Health checks hit `/api/health`.
4. On the free plan, the service sleeps after 15 minutes of inactivity. Run `npm run keepalive:setup` (needs `UPSTASH_QSTASH_TOKEN` and `RENDER_URL`) to schedule a ping every 5 minutes and keep it warm, or upgrade to a paid plan to avoid cold starts entirely.

`vercel.json` and the `@vercel/analytics` dependency are unused leftovers from the initial `create-next-app` scaffold and can be removed if you'd like to fully drop the Vercel references — they have no effect on the Render deployment.

## Clerk to Supabase: keep the instances aligned

Logged-in reads (dashboard history, analytics, admin) go through Supabase **Row Level Security** using the current Clerk session token (`src/lib/supabase/server.ts`). Supabase validates that token against the **one** Clerk instance configured in its auth provider, then applies `auth.jwt()->>'sub' = user_id`.

The app's Clerk instance and the Supabase Clerk provider must be the **same instance** (the native Supabase integration binds to a single Clerk domain):

- Live: `https://clerk.screenshotapi.tech`
- Test (local): `https://willing-arachnid-68.clerk.accounts.dev`

If they disagree (e.g. `.env.local` uses test keys while the Supabase dashboard still points at the live domain), every RLS read returns nothing: history shows "No screenshots yet" for **all** captures, even though new captures still render and save (writes use the service role and bypass RLS). The history page now surfaces this as an "Unable to load history" banner.

Fix: **Supabase Dashboard → Authentication → Sign In / Providers → Clerk → set the Clerk domain** to match the instance in use, then restart the app so the session/keys line up. Switch it back when you return to live keys.

## Pre-launch checklist

1. **Build** — `npm run build` must pass locally or in CI.
2. **Database** — run `scripts/verify-db.sql` in the Supabase SQL Editor. No rows returned = schema looks good. If rows appear, apply the matching migration from `supabase/migrations/`.
3. **Smoke test** — against your deployed API:
   ```bash
   npm run launch:check -- --base https://api.screenshotapi.tech --key sk_live_xxx
   ```
4. **Manual** — sign in, capture via API, confirm `/dashboard/history` shows the screenshot; test checkout on a test account.

## Applying migrations to the live Supabase project

Migrations live in `supabase/migrations/`. Some are applied by hand via the **Supabase Dashboard → SQL Editor** (there is no `supabase_migrations` tracking table). If the app renders captures but `/dashboard/history` stays empty, the DB is likely missing part of a migration: a common drift is **`013_projects_and_usage.sql`**, which adds `project_id` to `screenshots`, `screenshot_jobs`, `api_keys`, and `api_key_logs` — a partial run can skip those `ADD COLUMN` statements:

```
column screenshots.project_id does not exist
```

A capture still renders because uploads go through the service role (bypasses RLS), but the `screenshots` INSERT throws the missing-column error, which the code swallows — so nothing lands in history. Fix: run **`021_repair_missing_project_columns.sql`** in the SQL Editor (fully idempotent). Re-applying the whole `013_*.sql` can fail because its `CREATE POLICY` statements are not idempotent.

For signed URLs and customer bucket upload (Pro+), also run **`022_signed_urls_and_customer_upload.sql`**, then **`022_repair_upload_policies.sql`** if policy creation failed partway through.
