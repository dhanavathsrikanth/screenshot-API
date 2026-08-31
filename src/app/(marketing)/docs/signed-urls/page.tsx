import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Signed screenshot URLs - ScreenshotAPI",
  description:
    "HMAC-signed GET /api/take URLs so OG tags and img src never embed your secret API key.",
  alternates: { canonical: "/docs/signed-urls" },
};

export default function SignedUrlsPage() {
  const node = `import { signTakeUrl } from "screenshotapi";

const src = await signTakeUrl({
  baseUrl: "${siteConfig.apiUrl}",
  accessKey: process.env.SCREENSHOT_ACCESS_KEY,
  signingSecret: process.env.SCREENSHOT_SIGNING_SECRET,
  params: { url: "https://example.com", format: "png", full_page: "true" },
  expires: Math.floor(Date.now() / 1000) + 60 * 60,
});
// <img src={src} />  or  <meta property="og:image" content={src} />`;

  const python = `from screenshotapi import sign_take_url
import time

src = sign_take_url(
    base_url="${siteConfig.apiUrl}",
    access_key="ak_live_...",
    signing_secret="ss_...",
    params={"url": "https://example.com", "format": "png"},
    expires=int(time.time()) + 3600,
)`;

  return (
    <div className="pt-16">
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6">
        <nav className="mb-8 text-sm text-[var(--dim)]">
          <Link href="/docs" className="hover:text-[var(--ink)]">Docs</Link>
          <span aria-hidden="true"> / </span>
          <span>Signed URLs</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">Signed GET URLs</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--dim)]">
          Browsers cannot send an Authorization header on <code className="font-mono text-xs">&lt;img&gt;</code> or
          Open Graph crawlers. Sign the query with your <strong>signing secret</strong> (server-side only) and
          put the public <code className="font-mono text-xs">access_key</code> in the URL.
        </p>
        <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-[var(--dim)]">
          <li>Create an API key. Copy the access key and signing secret (shown once).</li>
          <li>Build the canonical query: sort parameter names, RFC 3986-encode keys and values, omit <code className="font-mono text-xs">signature</code>.</li>
          <li>HMAC-SHA256 (hex) with the signing secret. Append <code className="font-mono text-xs">&amp;signature=</code>.</li>
          <li>Optional <code className="font-mono text-xs">expires</code> is a Unix timestamp in seconds. Expired URLs return <code className="font-mono text-xs">signed_url_expired</code>.</li>
        </ol>
        <p className="mt-4 text-sm text-[var(--dim)]">
          Do not put <code className="font-mono text-xs">sk_live_</code> in the query. Rotating the signing secret
          invalidates existing signed URLs; the secret API key is unchanged.
        </p>
        <h2 className="mt-10 text-xl font-semibold">Node.js</h2>
        <div className="mt-4"><CodeBlock label="js" code={node} /></div>
        <h2 className="mt-10 text-xl font-semibold">Python</h2>
        <div className="mt-4"><CodeBlock label="python" code={python} /></div>
      </article>
    </div>
  );
}
