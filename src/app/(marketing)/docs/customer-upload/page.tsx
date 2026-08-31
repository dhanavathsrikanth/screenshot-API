import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Customer bucket upload - ScreenshotAPI",
  description:
    "Copy each capture into your Amazon S3, Cloudflare R2, or GCS bucket on Pro and Scale.",
  alternates: { canonical: "/docs/customer-upload" },
};

export default function CustomerUploadPage() {
  const example = `{
  "url": "https://your-cdn.example.com/screenshots/abc.png",
  "storage_url": "https://cdn.screenshotapi.tech/...",
  "upload_url": "https://your-cdn.example.com/screenshots/abc.png"
}`;

  return (
    <div className="pt-16">
      <article className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6">
        <nav className="mb-8 text-sm text-[var(--dim)]">
          <Link href="/docs" className="hover:text-[var(--ink)]">Docs</Link>
          <span aria-hidden="true"> / </span>
          <span>Customer upload</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">Customer S3 / R2 / GCS</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--dim)]">
          On <strong>Pro</strong> and <strong>Scale</strong>, configure a destination on a project. After every
          successful capture we still store a copy for dashboard history, then PutObject into your bucket.
          JSON responses prefer your public URL as <code className="font-mono text-xs">url</code> and also return{" "}
          <code className="font-mono text-xs">upload_url</code>.
        </p>
        <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-[var(--dim)]">
          <li>Amazon S3 — region + access keys. Optional custom endpoint for MinIO-compatible stores (https only).</li>
          <li>Cloudflare R2 — S3 API endpoint plus a public r2.dev or custom domain prefix.</li>
          <li>GCS — HMAC keys and <code className="font-mono text-xs">https://storage.googleapis.com</code>.</li>
        </ul>
        <p className="mt-4 text-sm text-[var(--dim)]">
          Endpoints and public prefixes are SSRF-checked (https, no private IPs). Secrets are encrypted at rest
          (AES-256-GCM) and never returned after save. A failed customer copy does not fail the capture.
        </p>
        <p className="mt-4 text-sm text-[var(--dim)]">
          Open <Link href="/dashboard/projects" className="text-orange-600 hover:underline">Projects</Link> and expand
          Customer bucket. Saving with a new secret runs a write/delete connection test.
        </p>
        <h2 className="mt-10 text-xl font-semibold">Response shape</h2>
        <div className="mt-4"><CodeBlock label="json" code={example} /></div>
      </article>
    </div>
  );
}
