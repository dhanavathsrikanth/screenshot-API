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
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          Free tool
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Free Website Screenshot
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
          Paste any URL and capture it as a PNG, JPEG, or WebP image. Pick your viewport
          width, toggle full-page or dark mode, and download instantly.
        </p>
      </div>

      <div className="mt-10">
        <ToolCapture mode="screenshot" />
      </div>

      <MoreTools active="/tools" />
    </div>
  );
}
