import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Official SDKs - ScreenshotAPI",
  description: "Installable Node.js and Python clients for ScreenshotAPI, including signed GET URLs.",
  alternates: { canonical: "/docs/sdks" },
};

export default function SdksPage() {
  const npm = `npm install screenshotapi

import { ScreenshotAPI } from "screenshotapi";

const client = new ScreenshotAPI({ apiKey: process.env.SCREENSHOT_API_KEY, baseUrl: "${siteConfig.apiUrl}" });
const png = await client.take({ url: "https://example.com", format: "png" });
const json = await client.takeJson({ url: "https://example.com", full_page: true });`;

  const pip = `pip install screenshotapi

from screenshotapi import ScreenshotAPI

client = ScreenshotAPI(api_key="sk_live_...", base_url="${siteConfig.apiUrl}")
png = client.take(url="https://example.com", format="png")
meta = client.take_json(url="https://example.com", full_page=True)`;

  return (
    <div className="pt-16">
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6">
        <nav className="mb-8 text-sm text-[var(--dim)]">
          <Link href="/docs" className="hover:text-[var(--ink)]">Docs</Link>
          <span aria-hidden="true"> / </span>
          <span>SDKs</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">Official SDKs</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--dim)]">
          Thin clients over <code className="font-mono text-xs">fetch</code> / urllib. Same endpoints as the HTTP API.
          Until packages are published, use the <code className="font-mono text-xs">sdks/js</code> and{" "}
          <code className="font-mono text-xs">sdks/python</code> folders in the repo.
        </p>
        <h2 className="mt-10 text-xl font-semibold">Node.js</h2>
        <div className="mt-4"><CodeBlock label="js" code={npm} /></div>
        <h2 className="mt-10 text-xl font-semibold">Python</h2>
        <div className="mt-4"><CodeBlock label="python" code={pip} /></div>
        <p className="mt-8 text-sm text-[var(--dim)]">
          For <code className="font-mono text-xs">&lt;img&gt;</code> tags see{" "}
          <Link href="/docs/signed-urls" className="text-orange-600 hover:underline">signed URLs</Link>
          . For copying files into your bucket see{" "}
          <Link href="/docs/customer-upload" className="text-orange-600 hover:underline">customer upload</Link>.
        </p>
      </article>
    </div>
  );
}
