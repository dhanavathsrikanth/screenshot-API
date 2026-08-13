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
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          Free tool
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Free URL to PDF
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
          Convert any webpage into a clean, downloadable PDF document. Choose your page
          size, paste a URL, and get your PDF in seconds.
        </p>
      </div>

      <div className="mt-10">
        <ToolCapture mode="pdf" />
      </div>

      <MoreTools active="/tools/pdf" />
    </div>
  );
}
