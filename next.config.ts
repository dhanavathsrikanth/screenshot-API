import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/take": ["./node_modules/@sparticuz/chromium/**", "./node_modules/ffmpeg-static/**"],
    "/api/take/bulk": ["./node_modules/@sparticuz/chromium/**", "./node_modules/ffmpeg-static/**"],
    "/api/tools/capture": ["./node_modules/@sparticuz/chromium/**", "./node_modules/ffmpeg-static/**"],
    "/api/v1/screenshots": ["./node_modules/@sparticuz/chromium/**", "./node_modules/ffmpeg-static/**"],
    "/api/v1/screenshots/*": ["./node_modules/@sparticuz/chromium/**", "./node_modules/ffmpeg-static/**"],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: true,
});
