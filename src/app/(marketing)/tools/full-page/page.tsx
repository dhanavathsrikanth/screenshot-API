import type { Metadata } from "next";
import { ToolCapture } from "@/components/tools/tool-capture";
import { MoreTools } from "@/components/tools/more-tools";

export const metadata: Metadata = {
  title: "Free Full Page Screenshot Tool - ScreenshotAPI",
  description:
    "Capture an entire webpage, including everything below the fold, as a full-page screenshot. Free, no registration required.",
  alternates: { canonical: "/tools/full-page" },
  openGraph: {
    title: "Free Full Page Screenshot Tool - ScreenshotAPI",
    description:
      "Capture entire webpages in one image — including everything below the fold.",
    url: "/tools/full-page",
    type: "website",
  },
};

export default function FullPageScreenshotToolPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          Free tool
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Free Full Page Screenshot
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
          Capture an entire webpage in one image — including content below the fold.
          Just paste a URL and the full page is rendered and downloaded automatically.
        </p>
      </div>

      <div className="mt-10">
        <ToolCapture mode="fullpage" />
      </div>

      <MoreTools active="/tools/full-page" />
    </div>
  );
}
