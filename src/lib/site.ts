export const siteConfig = {
  name: "ScreenshotAPI",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://screenshotapi.tech",
  description:
    "Render website screenshots in one simple API call. Block cookie banners, ads, and chat widgets. Full-page, high-resolution, dark mode, and more.",
  email: "hello@screenshotapi.tech",
} as const;

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
