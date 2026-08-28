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
