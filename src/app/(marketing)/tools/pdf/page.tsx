import type { Metadata } from "next";
import { ToolCapture } from "@/components/tools/tool-capture";
import { MoreTools } from "@/components/tools/more-tools";

export const metadata: Metadata = {
  title: "Free URL to PDF Tool - ScreenshotAPI",
  description:
    "Convert any webpage into a downloadable PDF document. Choose A4, Letter, or Legal page size. Free, no registration required.",
  alternates: { canonical: "/tools/pdf" },
  openGraph: {
    title: "Free URL to PDF Tool - ScreenshotAPI",
    description:
      "Convert any webpage to a clean, downloadable PDF in seconds. No registration required.",
    url: "/tools/pdf",
    type: "website",
  },
};

export default function UrlToPdfToolPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <span className="text-4xl">📑</span>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Free URL to PDF</h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
          Convert any webpage into a clean, downloadable PDF document. Choose your page
          size, paste a URL, and get your PDF in seconds.
        </p>
      </div>

      <ToolCapture mode="pdf" />

      <MoreTools active="/tools/pdf" />
    </div>
  );
}
