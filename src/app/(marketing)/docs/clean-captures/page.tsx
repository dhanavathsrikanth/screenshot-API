import type { Metadata } from "next";
import Link from "next/link";
import { CLEAN_CAPTURE_SET } from "@/lib/screenshot/clean-capture-set";
import { siteConfig } from "@/lib/site";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Clean capture challenge set - ScreenshotAPI",
  description:
    "30 public URLs used to judge cookie banners, ads, chat widgets, and lazy full-page captures. Ads and consent overlays are blocked by default.",
  alternates: { canonical: "/docs/clean-captures" },
};

const labels: Record<(typeof CLEAN_CAPTURE_SET)[number]["overlay"], string> = {
  consent: "Cookie / CMP",
  ads: "Ads",
  chat: "Chat widget",
  newsletter: "Newsletter",
  lazy: "Lazy / control",
  mixed: "Mixed",
};

export default function CleanCapturesPage() {
  const example = `curl "${siteConfig.apiUrl}/api/take?url=https://www.theguardian.com&format=png&full_page=true" \\\n  -H "Authorization: Bearer sk_live_YOUR_KEY" \\\n  --output guardian.png\n\n# Compliance archive (keep the banner in frame):\ncurl "${siteConfig.apiUrl}/api/take?url=https://www.theguardian.com&block_ads=false&block_cookie_banners=false&clean_preset=off" \\\n  -H "Authorization: Bearer sk_live_YOUR_KEY" \\\n  --output guardian-with-banner.png`;

  return (
    <div className="pt-16">
      <article className="mx-auto max-w-4xl px-4 pb-20 pt-12 sm:px-6">
        <nav className="mb-8 text-sm text-[var(--dim)]">
          <Link href="/docs" className="hover:text-[var(--ink)]">Docs</Link>
          <span aria-hidden="true"> / </span>
          <span>Clean captures</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight">Clean capture challenge set</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--dim)]">
          Cookie walls are the usual reason a screenshot API looks broken. Our defaults hide
          consent banners, ads, trackers, and chat widgets. This is the public URL set we use
          to judge that claim — not a competitor bake-off with their pixels.
        </p>
        <p className="mt-3 text-sm text-[var(--dim)]">
          Defaults: <code className="font-mono text-xs">block_ads=true</code>,{" "}
          <code className="font-mono text-xs">block_cookie_banners=true</code>,{" "}
          <code className="font-mono text-xs">block_chats=true</code>,{" "}
          <code className="font-mono text-xs">clean_preset=default</code>. Set{" "}
          <code className="font-mono text-xs">block_*=false</code> and{" "}
          <code className="font-mono text-xs">clean_preset=off</code> when you must archive the
          page including overlays (compliance).
        </p>

        <div className="mt-8">
          <CodeBlock label="bash" code={example} />
        </div>

        <div className="mt-10 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Expected overlay</th>
                <th className="px-4 py-3 font-medium">Why it is here</th>
              </tr>
            </thead>
            <tbody>
              {CLEAN_CAPTURE_SET.map((row, i) => (
                <tr key={row.url} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-2.5 text-[var(--dim)]">{i + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
                      {row.url.replace("https://", "")}
                    </a>
                  </td>
                  <td className="px-4 py-2.5">{labels[row.overlay]}</td>
                  <td className="px-4 py-2.5 text-[var(--dim)]">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--dim)]">
          Sites change CMPs without notice. A miss on one URL is a selector-list bug, not a
          reason to turn blocking off globally. Extra CSS:{" "}
          <code className="font-mono">hide_selectors=preset:consent,.my-modal</code> or{" "}
          <code className="font-mono">clean_preset=strict</code> for newsletter popups.
        </p>
      </article>
    </div>
  );
}
