import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { TryIt } from "@/components/docs/try-it";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "API Reference & Documentation - ScreenshotAPI",
  description:
    "Full API reference for ScreenshotAPI: endpoints, parameters, authentication, error codes, rate limits, and code examples in cURL, Node.js, and Python.",
  alternates: { canonical: "/docs" },
};

const nav = [
  { href: "#overview", label: "Overview" },
  { href: "#quickstart", label: "Quick start" },
  { href: "#authentication", label: "Authentication" },
  { href: "#endpoints", label: "Endpoints" },
  { href: "#parameters", label: "Parameters" },
  { href: "#responses", label: "Responses & headers" },
  { href: "#errors", label: "Errors" },
  { href: "#rate-limits", label: "Rate limits & credits" },
  { href: "#sdks", label: "Code examples" },
  { href: "#playground", label: "Live playground" },
];

const endpoints = [
  {
    method: "GET",
    path: "/api/take",
    description:
      "Capture a screenshot and return the image or PDF bytes directly. All options as query string parameters.",
    auth: true,
  },
  {
    method: "POST",
    path: "/api/take",
    description:
      "Same capture with a JSON body. Returns JSON metadata plus a public storage URL when upload is available.",
    auth: true,
  },
  {
    method: "POST",
    path: "/api/take/bulk",
    description:
      "Capture up to 100 URLs in one request with configurable concurrency and retries.",
    auth: true,
  },
  {
    method: "GET",
    path: "/api/health",
    description: "Service health check. Returns 200 when upstream services are reachable.",
    auth: false,
  },
  {
    method: "GET",
    path: "/openapi.json",
    description: "OpenAPI 3.1 specification for all public endpoints.",
    auth: false,
  },
];

type Param = [name: string, type: string, def: string, description: string];

const params: Param[] = [
  ["url", "string", "—", "Website URL to screenshot. Scheme-less URLs are auto-prefixed with https://. One of url, html, or markdown is required."],
  ["html", "string", "—", "Raw HTML to render instead of a URL."],
  ["markdown", "string", "—", "Markdown to render instead of a URL or HTML."],
  ["format", "enum", "png", "png | jpeg | webp | pdf | gif | tiff | avif | svg | html. html returns the post-JavaScript page source."],
  ["quality", "integer 1–100", "80", "Output quality for lossy formats."],
  ["viewport_width", "integer", "1280", "Viewport width in pixels."],
  ["viewport_height", "integer", "720", "Viewport height in pixels."],
  ["device_scale_factor", "integer 1–3", "1", "Device scale factor (Retina/2x screenshots)."],
  ["full_page", "boolean", "false", "Capture the full scrollable page."],
  ["block_ads", "boolean", "true", "Block advertisement scripts."],
  ["block_cookie_banners", "boolean", "true", "Block cookie consent banners."],
  ["block_chats", "boolean", "true", "Block chat/widget scripts."],
  ["block_trackers", "boolean", "true", "Block tracking scripts."],
  ["block_images", "boolean", "false", "Block image resources."],
  ["block_fonts", "boolean", "false", "Block font resources."],
  ["block_media", "boolean", "false", "Block media resources."],
  ["block_stylesheets", "boolean", "false", "Block stylesheets."],
  ["block_scripts", "boolean", "false", "Block JavaScript."],
  ["block_xhr / block_fetch", "boolean", "false", "Block XHR or fetch requests."],
  ["block_websocket", "boolean", "false", "Block WebSocket connections."],
  ["block_manifest", "boolean", "false", "Block web app manifests."],
  ["block_other", "boolean", "false", "Block any other resource type."],
  ["block_domains", "string", "—", "Comma-separated hostnames to block."],
  ["block_url_patterns", "string", "—", "Comma-separated URL substrings to block."],
  ["dark_mode", "boolean", "false", "Emulate prefers-color-scheme: dark."],
  ["reduced_motion", "boolean", "false", "Emulate prefers-reduced-motion: reduce."],
  ["omit_background", "boolean", "false", "Transparent background (PNG/WebP)."],
  ["selector", "string", "—", "CSS selector to capture a single element."],
  ["hide_selectors", "string", "—", "Comma-separated CSS selectors to hide."],
  ["styles", "string", "—", "Custom CSS to inject before capture."],
  ["scripts", "string", "—", "Custom JavaScript to execute before capture."],
  ["click", "string", "—", "CSS selector to click before capturing."],
  ["delay", "integer ms", "0", "Delay between load and capture."],
  ["timeout", "integer ms", "10000", "Navigation timeout."],
  ["wait_until", "enum", "—", "load | domcontentloaded | networkidle0 | networkidle2."],
  ["proxy", "string", "—", "Proxy URL applied to the whole page."],
  ["proxy_per_request", "string", "—", "Proxy URL applied per resource request."],
  ["pdf_format", "enum", "—", "a4 | a3 | a2 | a1 | a0 | legal | letter | tabloid."],
  ["pdf_print_background", "boolean", "true", "Print CSS backgrounds in PDF."],
  ["pdf_margin_top/right/bottom/left", "string", "—", "PDF margins, e.g. 1in or 2cm."],
  ["full_page_scroll_by", "integer", "0", "Scroll step (px) for lazy-loaded full-page captures."],
  ["full_page_scroll_delay", "integer ms", "100", "Delay between scroll steps."],
  ["thumbnail_width", "integer", "—", "Downscale the result to this width."],
  ["thumbnail_height", "integer", "—", "Downscale the result to this height."],
  ["thumbnail_fit", "enum", "inside", "cover | contain | fill | inside | outside."],
  ["capture_beyond_viewport", "boolean", "true", "Capture content beyond the viewport."],
  ["from_surface", "boolean", "true", "Capture from the compositor surface."],
];

const errorCodes = [
  ["400", "invalid_parameters", "Request validation failed. Inspect details for field-level errors."],
  ["400", "invalid_url", "URL must use http:// or https://. Other schemes are rejected."],
  ["400", "missing_target", "Provide one of url, html, or markdown."],
  ["401", "unauthorized", "Missing or invalid API key, or no active session."],
  ["402", "insufficient_credits", "No credits remaining. Upgrade or buy credits in the dashboard."],
  ["403", "plan_feature", "The requested format or feature requires a paid plan."],
  ["429", "rate_limited", "Rate limit exceeded. Respect the Retry-After header."],
  ["500", "internal_error", "Unexpected server error. Retry with exponential backoff."],
  ["503", "service_unavailable", "An upstream service is unavailable. Check /api/health."],
];

const responseHeaders = [
  ["X-Request-Id", "Correlation ID for this request. Also returned in error bodies for support queries."],
  ["X-Cache", "HIT or MISS. HIT means the response was served from cache."],
  ["X-Credits-Used", "Credits consumed by this request."],
  ["X-RateLimit-Limit", "Requests allowed per minute for your plan."],
  ["X-RateLimit-Remaining", "Requests remaining in the current window."],
  ["X-RateLimit-Reset", "Unix timestamp (ms) when the window resets."],
  ["Retry-After", "On 429 — seconds to wait before retrying."],
];

function MethodBadge({ method }: { method: string }) {
  const styles =
    method === "GET"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
      : method === "POST"
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`inline-flex w-14 items-center justify-center rounded-md px-2 py-1 font-mono text-xs font-semibold ${styles}`}>
      {method}
    </span>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 border-l border-[var(--border)]">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="-ml-px block border-l-2 border-transparent px-4 py-1.5 text-sm text-slate-500 transition-colors hover:border-indigo-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <section id="overview" className="scroll-mt-24">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              Developer docs
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
              ScreenshotAPI Reference
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
              One simple API call renders any webpage to a clean screenshot or PDF — with
              cookie-banner, ad, and chat removal built in. Authenticate with an API key,
              render, and get image bytes or a storage URL back.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#quickstart"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                Get started
              </a>
              <a
                href="#playground"
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
              >
                Try the API live
              </a>
              <a
                href="/openapi.json"
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
              >
                OpenAPI spec
              </a>
            </div>
          </section>

          <section id="quickstart" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Quick start</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Render a screenshot of any website in one request. URL parameters are optional
              — scheme-less URLs like <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-sm text-slate-700 dark:text-slate-300">example.com</code> work too.
            </p>
            <div className="mt-4">
              <CodeBlock
                label="bash"
                code={`curl -H "Authorization: Bearer sk_your_api_key" \\\n  "${siteConfig.url}/api/take?url=https://example.com&format=png" \\\n  --output screenshot.png`}
              />
            </div>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              The image bytes are returned directly — ready to save, stream, or serve.
            </p>
          </section>

          <section id="authentication" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Authentication</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Every screenshot request must be authenticated. Create API keys in the{" "}
              <a href="/dashboard/api-keys" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
                dashboard
              </a>{" "}
              and send them one of two ways:
            </p>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
                <p className="mb-2 font-mono text-sm font-semibold text-slate-900 dark:text-white">Authorization header</p>
                <CodeBlock label="http" code={'Authorization: Bearer sk_your_api_key'} />
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
                <p className="mb-2 font-mono text-sm font-semibold text-slate-900 dark:text-white">Custom header</p>
                <CodeBlock label="http" code={'X-Api-Key: sk_your_api_key'} />
              </div>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Requests made from the dashboard while signed in are authenticated automatically
              via your session — no key needed.
            </p>
          </section>

          <section id="endpoints" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Endpoints</h2>
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[560px] rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
                {endpoints.map((ep, i) => (
                  <div
                    key={ep.path + ep.method}
                    className={`flex items-start gap-4 px-5 py-4 ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
                  >
                    <MethodBadge method={ep.method} />
                    <div>
                      <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{ep.path}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{ep.description}</p>
                      {!ep.auth && (
                        <p className="mt-1.5">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            No authentication required
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="parameters" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Parameters</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              All options are valid in the query string (GET) or JSON body (POST). Booleans accept
              <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-sm text-slate-700 dark:text-slate-300"> true / false</code>.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Parameter</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Type</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Default</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {params.map(([name, type, def, description]) => (
                    <tr key={name} className="align-top">
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">{name}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">{type}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{def}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="responses" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Responses & headers</h2>
            <div className="mt-4 space-y-6">
              <div className="rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
                <p className="font-semibold text-slate-900 dark:text-white">GET /api/take</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Returns the raw image/PDF bytes with a <code className="font-mono text-xs">Content-Type</code> matching the format and a <code className="font-mono text-xs">Content-Disposition</code> filename.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
                <p className="font-semibold text-slate-900 dark:text-white">POST /api/take</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Returns JSON metadata and a public storage URL:</p>
                <div className="mt-3">
                  <CodeBlock
                    label="json"
                    code={'{\n  "url": "https://cdn.example.com/abc_123_example_com.png",\n  "format": "png",\n  "width": 1280,\n  "height": 720,\n  "size": 48213,\n  "cached": false\n}'}
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Header</th>
                      <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {responseHeaders.map(([name, description]) => (
                      <tr key={name}>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">{name}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="errors" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Errors</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              All errors share one JSON envelope. The <code className="font-mono text-xs">requestId</code> matches the{" "}
              <code className="font-mono text-xs">X-Request-Id</code> header — include it when contacting support.
            </p>
            <div className="mt-4">
              <CodeBlock
                label="json"
                code={'{\n  "error": {\n    "code": "invalid_parameters",\n    "message": "Invalid parameters.",\n    "requestId": "4f7b2c9a-…",\n    "details": { "fieldErrors": { "url": ["Invalid url"] } }\n  }\n}'}
              />
            </div>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Status</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Code</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {errorCodes.map(([status, code, description]) => (
                    <tr key={code}>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${status.startsWith("4") ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"}`}>
                          {status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">{code}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="rate-limits" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Rate limits & credits</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Each plan has a per-minute request limit. Responses include the current limit,
              remaining requests, and the window reset time via the{" "}
              <code className="font-mono text-xs">X-RateLimit-*</code> headers. Exceeding the limit returns 429 with a{" "}
              <code className="font-mono text-xs">Retry-After</code> header.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Plan</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Screenshots / mo</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Requests / min</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {[
                    ["Free", "100", "10", "No"],
                    ["Starter", "2,500", "40", "Yes"],
                    ["Pro", "15,000", "120", "Yes"],
                    ["Business", "50,000", "500", "Yes"],
                  ].map(([plan, screens, rate, pdf]) => (
                    <tr key={plan}>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{plan}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{screens}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{rate}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{pdf}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Every render deducts credits based on format and page count;{" "}
              <code className="font-mono text-xs">X-Credits-Used</code> reports the cost.
            </p>
          </section>

          <section id="sdks" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Code examples</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              ScreenshotAPI is just HTTP — use any language. Replace{" "}
              <code className="font-mono text-xs">sk_your_api_key</code> with a key from the dashboard.
            </p>
            <div className="mt-4 space-y-6">
              <div>
                <p className="mb-2 font-semibold text-slate-900 dark:text-white">cURL</p>
                <CodeBlock
                  label="bash"
                  code={`curl -H "Authorization: Bearer sk_your_api_key" \\\n  "${siteConfig.url}/api/take?url=https://example.com&format=png" \\\n  --output screenshot.png`}
                />
              </div>
              <div>
                <p className="mb-2 font-semibold text-slate-900 dark:text-white">Node.js</p>
                <CodeBlock
                  label="javascript"
                  code={`const response = await fetch(\n  "${siteConfig.url}/api/take?url=https://example.com&format=png",\n  { headers: { Authorization: "Bearer sk_your_api_key" } }\n);\nif (!response.ok) throw new Error(await response.text());\n\nconst buffer = Buffer.from(await response.arrayBuffer());\nrequire("fs").writeFileSync("screenshot.png", buffer);`}
                />
              </div>
              <div>
                <p className="mb-2 font-semibold text-slate-900 dark:text-white">Python</p>
                <CodeBlock
                  label="python"
                  code={`import requests\n\nresponse = requests.get(\n    "${siteConfig.url}/api/take",\n    params={"url": "https://example.com", "format": "png", "full_page": "true"},\n    headers={"Authorization": "Bearer sk_your_api_key"},\n)\nresponse.raise_for_status()\n\nwith open("screenshot.png", "wb") as f:\n    f.write(response.content)`}
                />
              </div>
              <div>
                <p className="mb-2 font-semibold text-slate-900 dark:text-white">Bulk (JSON)</p>
                <CodeBlock
                  label="json"
                  code={`curl -X POST "${siteConfig.url}/api/take/bulk" \\\n  -H "Authorization: Bearer sk_your_api_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{"urls": ["https://example.com", "https://vercel.com"], "format": "webp"}'`}
                />
              </div>
            </div>
          </section>

          <section id="playground" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Live playground</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Try the real endpoint below. Your render appears here, and the exact cURL command is generated for you.
            </p>
            <div className="mt-4">
              <TryIt />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
