import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/take": ["./node_modules/@sparticuz/chromium/**"],
    "/api/take/bulk": ["./node_modules/@sparticuz/chromium/**"],
    "/api/tools/capture": ["./node_modules/@sparticuz/chromium/**"],
  },
};

export default nextConfig;
