import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Free Screenshot Tools - ScreenshotAPI",
  description: "Free online screenshot tools. No registration required.",
};

const tools = [
  {
    title: "Website Screenshot",
    description: "Take a screenshot of any website. Customize viewport, format, and more.",
    href: "/",
    icon: "🖼️",
  },
  {
    title: "Full Page Screenshot",
    description: "Capture entire webpages including content below the fold.",
    href: "/tools/full-page",
    icon: "📄",
  },
  {
    title: "URL to PDF",
    description: "Convert any webpage to a downloadable PDF document.",
    href: "/tools/pdf",
    icon: "📑",
  },
  {
    title: "URL to Markdown",
    description: "Extract clean Markdown from any public webpage.",
    href: "/tools/markdown",
    icon: "📝",
  },
];

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-4">Free Screenshot Tools</h1>
      <p className="text-zinc-600 dark:text-zinc-400 mb-12">
        No registration required. Just paste a URL and get your result.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <Link
            key={tool.title}
            href={tool.href}
            className="rounded-xl border border-[var(--border)] p-6 hover:border-indigo-500/50 transition-colors"
          >
            <span className="text-2xl">{tool.icon}</span>
            <h3 className="mt-4 font-semibold">{tool.title}</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {tool.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
