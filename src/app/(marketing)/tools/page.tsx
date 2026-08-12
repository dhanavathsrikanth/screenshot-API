import type { Metadata } from "next";
import { ToolCapture } from "@/components/tools/tool-capture";
import { MoreTools } from "@/components/tools/more-tools";

export const metadata: Metadata = {
  title: "Free Website Screenshot Tool - ScreenshotAPI",
  description:
    "Take a screenshot of any website for free. Choose PNG, JPEG, or WebP, set your viewport, and download instantly. No registration required.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Free Website Screenshot Tool - ScreenshotAPI",
    description:
      "Screenshot any website in seconds — PNG, JPEG, or WebP. No registration required.",
    url: "/tools",
    type: "website",
  },
};

export default function WebsiteScreenshotToolPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <span className="text-4xl">🖼️</span>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Free Website Screenshot</h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
          Paste any URL and capture it as a PNG, JPEG, or WebP image. Pick your viewport
          width, toggle full-page or dark mode, and download instantly.
        </p>
      </div>

      <ToolCapture mode="screenshot" />

      <MoreTools active="/tools" />
    </div>
  );
}
