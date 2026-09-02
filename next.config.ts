import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Chromium is required for Puppeteer; ffmpeg is provided by system ffmpeg
  // on Render (apt-get) and by ffmpeg-static locally. Don't force-trace the
  // 80 MB ffmpeg binary into the bundle — on Render free (512 MB) this
  // pushes the server over memory and causes 502s. resolveFfmpegPath() falls
  // back to `ffmpeg` on PATH.
  outputFileTracingIncludes: {
    "/api/take": ["./node_modules/@sparticuz/chromium/**"],
    "/api/take/bulk": ["./node_modules/@sparticuz/chromium/**"],
    "/api/tools/capture": ["./node_modules/@sparticuz/chromium/**"],
    "/api/v1/screenshots": ["./node_modules/@sparticuz/chromium/**"],
    "/api/v1/screenshots/*": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: true,
});
