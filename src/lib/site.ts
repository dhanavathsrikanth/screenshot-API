export const siteConfig = {
  name: "ScreenshotAPI",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://screenshotapi.tech",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "https://api.screenshotapi.tech",
  description:
    "Website capture infrastructure for products that ship screenshots. Turn public webpages into clean images or PDFs with one API call. Full-page capture and PDF included on Free.",
  email: "hello@screenshotapi.tech",
} as const;

export function absoluteUrl(path: string): string {
  return `${siteConfig.url}${path.startsWith("/") ? path : `/${path}`}`;
}
