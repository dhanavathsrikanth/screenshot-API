import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation - ScreenshotAPI",
  description: "Learn how to use the ScreenshotAPI screenshot API.",
};

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-8">Documentation</h1>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Render a screenshot of any website with a single GET request:
        </p>
        <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 mb-4">
          <code className="text-sm text-green-400">
            GET /api/take?url=https://example.com&amp;format=png
          </code>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400">
          Returns the rendered image directly in the response.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Render HTML</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Render HTML content as an image:
        </p>
        <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 mb-4">
          <code className="text-sm text-green-400">
            GET /api/take?html=&lt;h1&gt;Hello, world!&lt;/h1&gt;&amp;format=png
          </code>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Available Options</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-3 pr-4 font-semibold">Parameter</th>
                <th className="text-left py-3 pr-4 font-semibold">Type</th>
                <th className="text-left py-3 pr-4 font-semibold">Default</th>
                <th className="text-left py-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {[
                ["url", "string", "-", "A website URL to screenshot"],
                ["html", "string", "-", "HTML content to render"],
                ["format", "png|jpeg|webp|pdf|gif|tiff|avif|svg|html", "png", "Output format (html returns rendered page source)"],
                ["quality", "number (1-100)", "80", "Image quality (jpeg/webp)"],
                ["viewport_width", "number", "1280", "Viewport width in pixels"],
                ["viewport_height", "number", "720", "Viewport height in pixels"],
                ["device_scale_factor", "number (1-3)", "1", "Device scale factor for Retina"],
                ["full_page", "boolean", "false", "Capture full scrollable page"],
                ["block_cookie_banners", "boolean", "true", "Block cookie consent banners"],
                ["block_ads", "boolean", "true", "Block advertisements"],
                ["block_trackers", "boolean", "true", "Block tracking scripts"],
                ["block_chats", "boolean", "true", "Block chat widgets"],
                ["dark_mode", "boolean", "false", "Emulate prefers-color-scheme: dark"],
                ["omit_background", "boolean", "false", "Transparent background"],
                ["selector", "string", "-", "CSS selector for element capture"],
                ["hide_selectors", "string", "-", "Comma-separated CSS selectors to hide"],
                ["styles", "string", "-", "Custom CSS to inject"],
                ["scripts", "string", "-", "Custom JavaScript to execute"],
                ["delay", "number (ms)", "0", "Delay before capture"],
                ["timeout", "number (ms)", "30000", "Navigation timeout"],
              ].map(([param, type, defaultVal, description]) => (
                <tr key={param}>
                  <td className="py-3 pr-4 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                    {param}
                  </td>
                  <td className="py-3 pr-4 text-zinc-500">{type}</td>
                  <td className="py-3 pr-4 text-zinc-500">{defaultVal}</td>
                  <td className="py-3 text-zinc-600 dark:text-zinc-400">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Extract Rendered HTML</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Get the fully rendered page source (after JavaScript execution, ad-blocking, etc.):
        </p>
        <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 mb-4">
          <code className="text-sm text-green-400">
            GET /api/take?url=https://example.com&format=html
          </code>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400">
          Returns the post-JavaScript HTML as UTF-8 text. Useful for scraping, SEO analysis,
          or feeding into LLMs. Ad-blocking, cookie-banner removal, and other features still apply.
        </p>
      </section>

      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">PDF Generation</h2>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Convert any URL or HTML to PDF with full control over page size and margins:
        </p>
        <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 mb-4">
          <code className="text-sm text-green-400">
            GET /api/take?url=https://example.com&format=pdf&pdf_format=letter&pdf_margin_top=1in
          </code>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          Render HTML content directly as PDF:
        </p>
        <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 mb-4">
          <code className="text-sm text-green-400">
            GET /api/take?html=<h1>Invoice</h1>&format=pdf&pdf_format=a4
          </code>
        </div>
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-2 pr-4 font-semibold">Parameter</th>
              <th className="text-left py-2 pr-4 font-semibold">Values</th>
              <th className="text-left py-2 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            <tr>
              <td className="py-2 pr-4 font-mono text-xs text-indigo-600 dark:text-indigo-400">pdf_format</td>
              <td className="py-2 pr-4 text-zinc-500">a4 (default), a3, a2, a1, a0, legal, letter, tabloid</td>
              <td className="py-2 text-zinc-600 dark:text-zinc-400">Page size</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs text-indigo-600 dark:text-indigo-400">pdf_print_background</td>
              <td className="py-2 pr-4 text-zinc-500">boolean (default: true)</td>
              <td className="py-2 text-zinc-600 dark:text-zinc-400">Print CSS backgrounds</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-mono text-xs text-indigo-600 dark:text-indigo-400">pdf_margin_top/right/bottom/left</td>
              <td className="py-2 pr-4 text-zinc-500">string (e.g., 1in, 2cm)</td>
              <td className="py-2 text-zinc-600 dark:text-zinc-400">Page margins</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mb-12" id="sdks">
        <h2 className="text-xl font-semibold mb-4">SDKs & Code Examples</h2>

        <h3 className="text-lg font-medium mb-2">cURL</h3>
        <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 mb-6">
          <code className="text-sm text-green-400">
            curl &quot;https://screenshotapi.tech/api/take?url=https://example.com&amp;format=png&quot; --output screenshot.png
          </code>
        </div>

        <h3 className="text-lg font-medium mb-2">Node.js</h3>
        <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 mb-6">
          <pre className="text-sm text-green-400">
{`const response = await fetch("https://screenshotapi.tech/api/take?url=https://example.com&format=png");
const buffer = Buffer.from(await response.arrayBuffer());
require("fs").writeFileSync("screenshot.png", buffer);`}
          </pre>
        </div>

        <h3 className="text-lg font-medium mb-2">Python</h3>
        <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 p-4 mb-6">
          <pre className="text-sm text-green-400">
{`import requests
response = requests.get("https://screenshotapi.tech/api/take", params={"url": "https://example.com", "format": "png"})
with open("screenshot.png", "wb") as f:
    f.write(response.content)`}
          </pre>
        </div>
      </section>

      <section className="mb-12" id="guides">
        <h2 className="text-xl font-semibold mb-4">Guides</h2>
        <ul className="space-y-3">
          {[
            ["Full-page Screenshots", "Capture entire webpages including lazy-loaded content."],
            ["Blocking Cookie Banners", "Automatically hide cookie consent popups."],
            ["Dark Mode Screenshots", "Render pages in dark mode with reduced motion."],
            ["Element Capture", "Screenshot specific parts of a page by CSS selector."],
            ["Custom JavaScript & CSS", "Inject code before rendering."],
            ["PDF Generation", "Convert any URL or HTML to PDF."],
            ["S3 Storage Integration", "Upload screenshots directly to your bucket."],
          ].map(([title, desc]) => (
            <li key={title} className="rounded-lg border border-[var(--border)] p-4">
              <h4 className="font-medium">{title}</h4>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{desc}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
