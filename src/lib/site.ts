export const siteConfig = {
  name: "ScreenshotAPI",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://screenshotapi.tech",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "https://api.screenshotapi.tech",
  description:
    "Screenshot API for products that ship captures. Cookie banners and ads blocked by default. 100 free renders, then $9 for full-page, PDF, and production volume.",
  email: "hello@screenshotapi.tech",
} as const;

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
