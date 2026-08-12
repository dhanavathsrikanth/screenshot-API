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
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-10">
        <span className="text-4xl">📄</span>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">Free Full Page Screenshot</h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
          Capture an entire webpage in one image — including content below the fold.
          Just paste a URL and the full page is rendered and downloaded automatically.
        </p>
      </div>

      <ToolCapture mode="fullpage" />

      <MoreTools active="/tools/full-page" />
    </div>
  );
}
