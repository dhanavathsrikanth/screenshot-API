import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { LanguageExamples } from "@/components/docs/language-examples";
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
  { href: "#v1-api", label: "v1 API (async jobs)" },
  { href: "#webhooks", label: "Webhooks" },
  { href: "#usage", label: "Usage & quotas" },
  { href: "#responses", label: "Responses & headers" },
  { href: "#errors", label: "Errors" },
  { href: "#rate-limits", label: "Rate limits & credits" },
  { href: "#caching", label: "Caching" },
  { href: "#security", label: "Security & SSRF" },
  { href: "#geo-targeting", label: "Geo-targeting" },
  { href: "#video-capture", label: "Video / GIF capture" },
  { href: "#best-practices", label: "Production best practices" },
  { href: "#sdks", label: "Code examples" },
  { href: "#mcp", label: "MCP Server" },
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
    method: "POST",
    path: "/api/v1/screenshots",
    description:
      "Create a screenshot job. Async by default (202 + status_url); append ?sync=true to block for the result. Full async/sync semantics below.",
    auth: true,
  },
  {
    method: "GET",
    path: "/api/v1/screenshots",
    description:
      "List your screenshot jobs, newest first. Supports limit (1–100, default 20) and before (ISO 8601 cursor) pagination.",
    auth: true,
  },
  {
    method: "GET",
    path: "/api/v1/screenshots/:id",
    description:
      "Poll a job by id. Returns completed screenshot details, failed error info, or the in-progress status. DELETE removes the job and its stored screenshot.",
    auth: true,
  },
  {
    method: "GET",
    path: "/api/v1/usage",
    description:
      "Current plan, monthly request usage, current-window request counts and cache hit rate, and credit balances.",
    auth: true,
  },
  {
    method: "GET",
    path: "/api/v1/webhooks",
    description:
      "List webhook endpoints. POST creates one and returns its signing secret. See the Webhooks section.",
    auth: true,
  },
  {
    method: "GET",
    path: "/api/v1/projects",
    description:
      "List your projects with API key and screenshot counts. POST creates a new project.",
    auth: true,
  },
  {
    method: "GET",
    path: "/api/v1/api-keys",
    description:
      "List your API keys (id, name, prefix, environment, project, activity). POST creates a key and returns it exactly once. DELETE /api/v1/api-keys/:id revokes a key.",
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
  ["readiness", "enum", "—", "fast | balanced | complete | custom. Controls when the page is considered ready."],
  ["wait_for_selector", "string", "—", "CSS selector to wait for before capture (use with custom readiness)."],
  ["wait_for_condition", "string", "—", "JavaScript expression to evaluate for readiness (custom readiness)."],
  ["user_agent", "string", "—", "Custom User-Agent string."],
  ["is_mobile", "boolean", "false", "Emulate mobile device (touch events, viewport meta)."],
  ["has_touch", "boolean", "false", "Enable touch event emulation."],
  ["proxy", "string", "—", "Proxy URL applied to the whole page."],
  ["proxy_per_request", "string", "—", "Proxy URL applied per resource request."],
  ["country", "string", "—", "ISO 3166-1 alpha-2 country code (e.g. US, DE, JP). Renders through a residential exit IP in that country. Pro plan and above; billed at 2× credits."],
  ["proxy_skip_images", "boolean", "false", "Skip proxy for image requests."],
  ["proxy_skip_fonts", "boolean", "false", "Skip proxy for font requests."],
  ["proxy_skip_media", "boolean", "false", "Skip proxy for media requests."],
  ["proxy_skip_stylesheets", "boolean", "false", "Skip proxy for stylesheet requests."],
  ["pdf_format", "enum", "—", "a4 | a3 | a2 | a1 | a0 | legal | letter | tabloid."],
  ["pdf_print_background", "boolean", "true", "Print CSS backgrounds in PDF."],
  ["pdf_margin_top/right/bottom/left", "string", "—", "PDF margins, e.g. 1in or 2cm."],
  ["full_page_scroll_by", "integer", "0", "Scroll step (px) for lazy-loaded full-page captures."],
  ["full_page_scroll_delay", "integer ms", "50", "Delay between scroll steps."],
  ["thumbnail_width", "integer", "—", "Downscale the result to this width."],
  ["thumbnail_height", "integer", "—", "Downscale the result to this height."],
  ["thumbnail_fit", "enum", "inside", "cover | contain | fill | inside | outside."],
  ["capture_beyond_viewport", "boolean", "true", "Capture content beyond the viewport."],
  ["from_surface", "boolean", "true", "Capture from the compositor surface."],
];

const errorCodes = [
  ["400", "invalid_parameters", "Request validation failed. Inspect details for field-level errors."],
  ["400", "invalid_url", "URL must use http:// or https://. Other schemes are rejected."],
  ["400", "invalid_country", "country must be a 2-letter ISO 3166-1 alpha-2 code (e.g. US, DE, JP)."],
  ["400", "unsupported_country", "The requested country is not available on the proxy network."],
  ["400", "missing_target", "Provide one of url, html, or markdown."],
  ["401", "unauthorized", "Missing or invalid API key, or no active session."],
  ["402", "insufficient_credits", "No credits remaining. Upgrade or buy credits in the dashboard."],
  ["403", "plan_feature", "The requested format or feature requires a paid plan."],
  ["429", "rate_limited", "Rate limit exceeded. Respect the Retry-After header."],
  ["500", "internal_error", "Unexpected server error. Retry with exponential backoff."],
  ["503", "service_unavailable", "An upstream service is unavailable. Check /api/health."],
  ["503", "geo_unavailable", "Geo-targeted rendering is temporarily unavailable."],
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
                code={`curl -H "Authorization: Bearer sk_your_api_key" \\\n  "${siteConfig.apiUrl}/api/take?url=https://example.com&format=png" \\\n  --output screenshot.png`}
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
                <CodeBlock label="http" code={'Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxx'} />
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
                <p className="mb-2 font-mono text-sm font-semibold text-slate-900 dark:text-white">Custom header</p>
                <CodeBlock label="http" code={'X-Api-Key: sk_live_xxxxxxxxxxxxxxxxxxxx'} />
              </div>
            </div>
            <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Prefix</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Environment</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Use for</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">sk_live_</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">Production</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">Real traffic in your deployed application.</td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">sk_test_</td>
                    <td className="whitespace-nowrap px-5 py-3 text-slate-600 dark:text-slate-300">Test</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">Local development and staging. Test keys never render billable screenshots.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Keys are scoped to a <a href="/dashboard/projects" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">project</a>,
              so keep environments separate. Only the prefix is ever shown again — the full key is displayed once at creation and cannot be recovered.
            </p>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
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

          <section id="v1-api" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">v1 API — async screenshot jobs</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              The v1 API is the recommended way to integrate. Captures run as jobs, so heavy
              pages never time out your request. Every v1 response uses the{" "}
              <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-sm text-slate-700 dark:text-slate-300">{"{success, data}"}</code> envelope.
            </p>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Create a job (async)</p>
              <CodeBlock
                label="bash"
                code={`curl -X POST "${siteConfig.apiUrl}/api/v1/screenshots" \\\n  -H "Authorization: Bearer sk_live_xxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://example.com", "format": "png", "full_page": true}'`}
              />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Returns <span className="font-mono text-xs">202</span> with the job id and a status URL:
              </p>
              <CodeBlock
                label="json"
                code={'{\n  "success": true,\n  "data": {\n    "id": "job_8f2a1c…",\n    "status": "processing",\n    "status_url": "/api/v1/screenshots/job_8f2a1c…"\n  }\n}'}
              />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Block for the result (sync)</p>
              <CodeBlock
                label="bash"
                code={`curl -X POST "${siteConfig.apiUrl}/api/v1/screenshots?sync=true" \\\n  -H "Authorization: Bearer sk_live_xxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://example.com", "format": "png"}'`}
              />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Polling is simpler with the dashboard&apos;s{" "}
                <a href="/dashboard/history" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">history</a>{" "}
                or a webhook, but <code className="font-mono text-xs">sync=true</code> is useful for short pages. Jobs are capped server-side, so use it sparingly.
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Poll a job</p>
              <CodeBlock
                label="bash"
                code={`curl "${siteConfig.apiUrl}/api/v1/screenshots/job_8f2a1c…" \\\n  -H "Authorization: Bearer sk_live_xxxx"`}
              />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="font-mono text-xs">processing</span> while queued,{" "}
                <span className="font-mono text-xs">completed</span> with a{" "}
                <span className="font-mono text-xs">screenshot</span> block (storage URL, format, dimensions, size), or{" "}
                <span className="font-mono text-xs">failed</span> with an <span className="font-mono text-xs">error</span> code and message.
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">List jobs</p>
              <CodeBlock
                label="bash"
                code={`curl "${siteConfig.apiUrl}/api/v1/screenshots?limit=20&before=2025-01-01T00:00:00Z" \\\n  -H "Authorization: Bearer sk_live_xxxx"`}
              />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Returns <span className="font-mono text-xs">screenshots</span> plus a{" "}
                <span className="font-mono text-xs">pagination</span> block with{" "}
                <span className="font-mono text-xs">next_cursor</span> and{" "}
                <span className="font-mono text-xs">has_more</span>.
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Delete a job</p>
              <CodeBlock
                label="bash"
                code={`curl -X DELETE "${siteConfig.apiUrl}/api/v1/screenshots/job_8f2a1c…" \\\n  -H "Authorization: Bearer sk_live_xxxx"`}
              />
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Deletes the stored screenshot from storage and the job record.
            </p>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Projects</p>
              <CodeBlock
                label="bash"
                code={`curl -X POST "${siteConfig.apiUrl}/api/v1/projects" \\\n  -H "Authorization: Bearer sk_live_xxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Marketing site"}'`}
              />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Keep production, staging, and test projects separate. Each v1 job records the project that owns the calling key.
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">v1 request body (camelCase)</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Use <code className="font-mono text-xs">device</code> for full device emulation (viewport, scale, touch events, and mobile/tablet user agent). Use <code className="font-mono text-xs">viewport</code> for responsive testing without device-specific emulation (desktop user agent, no touch flags). Override any setting with explicit <code className="font-mono text-xs">width</code>, <code className="font-mono text-xs">height</code>, or <code className="font-mono text-xs">device_scale_factor</code>.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <th className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">Field</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">Type</th>
                      <th className="px-4 py-2.5 font-semibold text-slate-900 dark:text-white">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {[
                      ["url", "string", "https:// URL to capture. One of url, html, or markdown."],
                      ["html", "string", "Raw HTML to render."],
                      ["markdown", "string", "Markdown to render."],
                      ["format", "enum", "png (default) | jpeg | webp | pdf. PDF requires a paid plan."],
                      ["width / height", "integer", "Viewport size (max 5000)."],
                      ["device", "enum", "mobile | tablet | desktop. Sets viewport, scale, touch, and user agent."],
                      ["viewport", "enum", "mobile_sm | mobile | mobile_lg | tablet | tablet_lg | desktop | desktop_hd. Viewport only (no device emulation)."],
                      ["device_scale_factor", "integer 1–3", "Override scale factor. Default comes from device or viewport preset."],
                      ["full_page", "boolean", "Capture the full scrollable page."],
                      ["delay", "integer", "Milliseconds to wait after load before capturing."],
                      ["wait_for", "enum", "load | domcontentloaded | networkidle0 | networkidle2."],
                      ["wait_for_selector", "string", "Wait until this CSS selector matches before capture."],
                      ["selector", "string", "Capture a single element instead of the viewport."],
                      ["dark_mode", "boolean", "Emulate prefers-color-scheme: dark."],
                      ["quality", "integer 1–100", "Output quality for lossy formats."],
                    ].map(([name, type, notes]) => (
                      <tr key={name}>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-indigo-600 dark:text-indigo-400">{name}</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-slate-500 dark:text-slate-400">{type}</td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section id="webhooks" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Webhooks</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Receive an HTTP POST when a screenshot job finishes — no polling required. Create
              endpoints in the{" "}
              <a href="/dashboard/webhooks" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">dashboard</a>{" "}
              or via <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-sm text-slate-700 dark:text-slate-300">POST /api/v1/webhooks</code>.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Event</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Fired when</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">screenshot.completed</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">A screenshot job finished successfully. Payload includes the storage URL.</td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">screenshot.failed</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">A screenshot job failed. Payload includes the error code and message.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Payload</p>
              <CodeBlock
                label="json"
                code={'{\n  "event": "screenshot.completed",\n  "created_at": "2025-01-01T00:00:00.000Z",\n  "data": {\n    "id": "job_8f2a1c…",\n    "status": "completed",\n    "status_url": "/api/v1/screenshots/job_8f2a1c…",\n    "screenshot": {\n      "id": "shot_…",\n      "url": "https://cdn.example.com/…png",\n      "format": "png",\n      "width": 1280,\n      "height": 720,\n      "size": 48213\n    },\n    "created_at": "…"\n  }\n}'}
              />
            </div>
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Verify signatures</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Every delivery sends a{" "}
                <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:text-slate-300">x-webhook-signature</code>{" "}
                header: <span className="font-mono text-xs">t=&lt;unix_ms&gt;,v1=&lt;hex&gt;</span>, where hex is an
                HMAC-SHA256 of <span className="font-mono text-xs">{"`${t}.${body}`"}</span> using your endpoint&apos;s signing secret. Always verify before trusting a payload:
              </p>
              <div className="mt-3">
                <CodeBlock
                  label="javascript"
                  code={`import { createHmac, timingSafeEqual } from "crypto";\n\nfunction verifyWebhook(signature, body, secret) {\n  const [t, v1] = signature.split(",").map((p) => p.split("=")[1]);\n  if (Math.abs(Date.now() - Number(t)) > 5 * 60_000) return false; // stale\n  const expected = createHmac("sha256", secret)\n    .update(\`\${t}.\${body}\`)\n    .digest("hex");\n  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));\n}`}
                />
              </div>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Deliveries retry up to 5 times with exponential backoff. Inspect failed deliveries and their attempts in the{" "}
              <a href="/dashboard/webhooks" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">dashboard</a>{" "}
              or via <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-sm text-slate-700 dark:text-slate-300">GET /api/v1/webhooks/deliveries</code>.
            </p>
          </section>

          <section id="usage" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Usage & quotas</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Check your current plan, usage, and credit balances at any time:
            </p>
            <div className="mt-4">
              <CodeBlock
                label="bash"
                code={`curl "${siteConfig.apiUrl}/api/v1/usage" \\\n  -H "Authorization: Bearer sk_live_xxxx"`}
              />
              <div className="mt-3">
                <CodeBlock
                  label="json"
                  code={'{\n  "success": true,\n  "data": {\n    "plan": "starter",\n    "period": { "start": "…", "end": "…", "reset_at": "…" },\n    "requests": { "used": 42, "limit": 2500, "remaining": 2458 },\n    "requests_this_window": { "total": 10, "cached": 7, "cache_hit_rate": 70 },\n    "credits": {\n      "used_this_cycle": 35,\n      "granted_this_cycle": 2500,\n      "balance": 2465,\n      "top_up_balance": 500,\n      "overage_enabled": true\n    }\n  }\n}'}
                />
              </div>
            </div>
            <p className="mt-4 text-slate-600 dark:text-slate-400">
              Monthly limits reset at <span className="font-mono text-xs">period.reset_at</span>. Cached hits
              are free and never deduct credits. When you run out, requests return{" "}
              <span className="font-mono text-xs">402 insufficient_credits</span> — upgrade or buy a top-up
              from the dashboard.
            </p>

            <div className="mt-6 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="font-semibold text-slate-900 dark:text-white">Plan entitlements</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                The response also includes an <code className="font-mono text-xs">entitlements</code> object
                — a machine-readable snapshot of the feature gates your key is allowed to use. Check it
                before building UI or client-side feature flags:
              </p>
              <div className="mt-3">
                <CodeBlock
                  label="json"
                  code={'{\n  "plan": "starter",\n  "entitlements": {\n    "formats": ["png", "jpeg", "webp", "pdf", "svg", "html"],\n    "full_page": true,\n    "element_capture": true,\n    "pdf_export": true,\n    "cloud_storage": true,\n    "ad_blocking": true,\n    "cookie_blocking": true,\n    "tracker_blocking": true,\n    "api_keys": 3,\n    "rate_limit_per_minute": 20,\n    "monthly_screenshots": 2500\n  }\n}'}
                />
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="font-semibold text-slate-900 dark:text-white">Manage keys programmatically</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Create a new key (returns the raw value once), list your keys, or revoke one:
              </p>
              <div className="mt-3 space-y-3">
                <CodeBlock
                  label="bash"
                  code={`# Create a test key, scoped to a project\ncurl "${siteConfig.apiUrl}/api/v1/api-keys" \\\n  -X POST \\\n  -H "Authorization: Bearer sk_live_xxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "staging CI", "environment": "test", "project_id": "proj_abc"}'`}
                />
                <CodeBlock
                  label="bash"
                  code={`# Revoke a key\ncurl "${siteConfig.apiUrl}/api/v1/api-keys/sk_abc123" \\\n  -X DELETE \\\n  -H "Authorization: Bearer sk_live_xxxx"`}
                />
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                Key creation is capped by your plan&apos;s <code className="font-mono text-xs">api_keys</code>{" "}
                limit — exceeding it returns{" "}
                <span className="font-mono text-xs">403 plan_feature</span>. Raw keys are shown only at
                creation time; we store only a salted hash, so treat them like passwords.
              </p>
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
              Legacy endpoints (<code className="font-mono text-xs">/api/take</code>) return the error envelope below.
              The v1 API wraps it one level deeper: <code className="font-mono text-xs">{"{ \"success\": false, \"error\": { \"code\", \"message\", \"requestId\", \"details\" } }"}</code>.
              Either way the <code className="font-mono text-xs">requestId</code> matches the{" "}
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

          <section id="caching" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Caching</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Screenshots are cached by URL and render options. A cache hit returns instantly,
              costs <strong className="text-slate-900 dark:text-white">zero credits</strong>, and is flagged by the{" "}
              <code className="font-mono text-xs">X-Cache: HIT</code> response header.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                Cache TTL is 1 hour on the free plan and 24 hours on paid plans, per account.
              </li>
              <li>
                Timing options that don&apos;t change the visual output (<span className="font-mono text-xs">delay</span>,{" "}
                <span className="font-mono text-xs">timeout</span>, <span className="font-mono text-xs">wait_until</span>) are excluded from the cache key, so identical-looking pages share one cached screenshot.
              </li>
              <li>
                Any other change to render options (viewport, format, full_page, selector, …) produces a different cache key.
              </li>
              <li>
                To bust the cache deliberately, vary an option you control — for example pass{" "}
                <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-sm text-slate-700 dark:text-slate-300">cache_bust</code> or a timestamped query param.
              </li>
              <li>
                Cached responses are served before any credit deduction, so repeated captures of the same page are effectively free.
              </li>
            </ul>
          </section>

          <section id="security" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Security & SSRF</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Screenshot APIs are a classic server-side request forgery (SSRF) vector. Here&apos;s
              what we do, and what you should keep in mind:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                Only <span className="font-mono text-xs">http://</span> and{" "}
                <span className="font-mono text-xs">https://</span> URLs are accepted; other schemes are rejected before rendering.
              </li>
              <li>
                Every URL is resolved through DNS and checked against private, loopback, link-local, and metadata-service ranges before a browser ever touches it.
              </li>
              <li>
                Requests to <span className="font-mono text-xs">169.254.169.254</span> (cloud metadata) are always blocked, and your custom CSS/JS injection options are sanitized.
              </li>
              <li>
                If you proxy requests on behalf of users, apply the same checks on your side — never let users hand arbitrary internal URLs to any render service.
              </li>
              <li>
                Keep API keys server-side. They are shown once at creation, so treat them like passwords and rotate via the dashboard if leaked.
              </li>
            </ul>
          </section>

          <section id="geo-targeting" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Geo-targeting</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Add a two-letter{" "}
              <span className="font-mono text-xs">country</span> parameter (ISO 3166-1 alpha-2) to
              any capture to render through a residential exit IP in that country — see the page
              exactly as a user there would, including geo-fenced pricing, content, and consent
              flows. Available on the Pro plan and above; geo renders are billed at 2× credits.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                Each render gets its own sticky session: one exit IP serves the whole page load,
                so logins and multi-request flows stay consistent.
              </li>
              <li>
                Combine with <span className="font-mono text-xs">user_agent</span>,{" "}
                <span className="font-mono text-xs">viewport</span>, and locale-specific URLs for full localization testing.
              </li>
              <li>
                Invalid codes return <span className="font-mono text-xs">400 invalid_country</span>;
                countries not covered by the network return{" "}
                <span className="font-mono text-xs">400 unsupported_country</span>.
              </li>
            </ul>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Example</p>
              <pre className="mt-2 overflow-x-auto font-mono text-xs text-slate-700 dark:text-slate-300">{`curl -X POST https://api.screenshotapi.tech/api/v1/screenshots \\
  -H "Authorization: Bearer $SCREENSHOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com", "country": "DE"}'`}</pre>
            </div>
          </section>

          <section id="video-capture" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Video / GIF capture</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Record a short video of any page as MP4, WebM, or animated GIF. Set{" "}
              <span className="font-mono text-xs">format</span> to <code>mp4</code>, <code>webm</code>, or{" "}
              <code>gif</code> and pass <span className="font-mono text-xs">video_seconds</span> (1–30) to
              capture a recording instead of a static screenshot. Available on the Scale plan only.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                The browser navigates to the URL, waits for readiness, then records for the specified duration
                using Chrome&apos;s built-in screencast API.
              </li>
              <li>
                Billed at <code>max(5, video_seconds)</code> credits per capture. Geo-targeted video renders are
                billed at 2× credits.
              </li>
              <li>
                Optional: <span className="font-mono text-xs">video_fps</span> (1–30, default 5) controls the
                capture frame rate. Higher values produce smoother video but use more credits.
              </li>
              <li>
                For animated GIF, the encoder uses an optimized two-pass palette for crisp output with minimal
                file size.
              </li>
            </ul>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Example</p>
              <pre className="mt-2 overflow-x-auto font-mono text-xs text-slate-700 dark:text-slate-300">{`curl -X POST https://api.screenshotapi.tech/api/v1/screenshots \\
  -H "Authorization: Bearer $SCREENSHOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com",
    "format": "mp4",
    "video_seconds": 5,
    "video_fps": 10
  }'`}</pre>
            </div>
          </section>

          <section id="best-practices" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Production best practices</h2>
            <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                <strong className="text-slate-900 dark:text-white">Use the async v1 API</strong> for anything beyond quick tests. Create the job, poll{" "}
                <span className="font-mono text-xs">status_url</span> (or use webhooks), and never block a request on a heavy render.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Prefer test keys in CI and staging.</strong> A separate{" "}
                <span className="font-mono text-xs">sk_test_</span> key keeps local and CI traffic out of your production usage numbers.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Retry with backoff.</strong> Retry transient errors (429, 5xx) using the{" "}
                <span className="font-mono text-xs">Retry-After</span> header, and honor the{" "}
                <span className="font-mono text-xs">X-RateLimit-*</span> headers rather than guessing.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Set the option you need explicitly.</strong> Rely on a 1280×720 desktop render by default, and add{" "}
                <span className="font-mono text-xs">full_page</span>, <span className="font-mono text-xs">wait_for_selector</span>, or{" "}
                <span className="font-mono text-xs">delay</span> only when the page requires it — it keeps renders fast and cache-friendly.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Verify webhook signatures</strong> with the code above and a 5-minute timestamp window before acting on events.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Use per-project keys.</strong> Scope production, staging, and per-customer integrations to separate projects so usage is attributable.
              </li>
            </ul>
          </section>

          <section id="sdks" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Code examples</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              ScreenshotAPI is plain HTTP — use any language and any HTTP client. Pick a language,
              then a recipe: quickstart, full-page options, bulk capture, or the recommended async
              job pattern. Every example is complete and runnable — set{" "}
              <code className="font-mono text-xs">SCREENSHOT_API_KEY</code> in your environment, replace nothing else.
            </p>
            <div className="mt-4">
              <LanguageExamples />
            </div>
            <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
              Prefer a walkthrough? Each language also has a dedicated guide with copy-paste samples
              and FAQs:{" "}
              {["python", "nodejs", "go", "php", "ruby", "java", "csharp", "rust", "curl"].map((slug, i, arr) => (
                <span key={slug}>
                  <a
                    href={`/screenshot-api/${slug}`}
                    className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
                  >
                    {slug === "nodejs" ? "Node.js" : slug === "csharp" ? "C#" : slug}
                  </a>
                  {i < arr.length - 1 ? " · " : ""}
                </span>
              ))}
            </p>
          </section>

          <section id="mcp" className="mt-16 scroll-mt-24">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">MCP Server for AI Agents</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              ScreenshotAPI ships an official{" "}
              <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400">
                MCP (Model Context Protocol)
              </a>{" "}
              server — so AI agents like Claude, Cursor, and Windsurf can capture screenshots,
              extract page content as Markdown, and check your account quota using natural language.
            </p>

            <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--border)] bg-white dark:bg-slate-900">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Tool</th>
                    <th className="px-5 py-3 font-semibold text-slate-900 dark:text-white">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">render-screenshot</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">Capture a screenshot of any URL. Supports device emulation, dark mode, ad/cookie/tracker blocking, geo-targeting, and full-page captures.</td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">capture-element</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">Capture a specific element on a page by CSS selector — headers, articles, widgets, or any identifiable DOM element.</td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">convert-to-markdown</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">Render a webpage and return its content as clean Markdown for analysis, summarization, or data processing.</td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">get-usage</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">Check your account quota, remaining screenshots, credits balance, and feature entitlements.</td>
                  </tr>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">get-screenshot</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-300">Retrieve a screenshot job by its ID — useful for polling async jobs.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Quick start with npx</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Run the MCP server directly — no installation needed:
              </p>
              <div className="mt-3">
                <CodeBlock
                  label="bash"
                  code={`SCREENSHOTAPI_KEY=sk_live_your_api_key npx --yes screenshotapi-mcp`}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Claude Desktop configuration</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Add to <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:text-slate-300">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) or{" "}
                <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 font-mono text-xs text-slate-700 dark:text-slate-300">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows):
              </p>
              <div className="mt-3">
                <CodeBlock
                  label="json"
                  code={`{
  "mcpServers": {
    "screenshotapi": {
      "command": "npx",
      "args": ["--yes", "screenshotapi-mcp"],
      "env": {
        "SCREENSHOTAPI_KEY": "sk_live_your_api_key_here"
      }
    }
  }
}`}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white p-5 dark:bg-slate-900">
              <p className="mb-2 font-semibold text-slate-900 dark:text-white">Environment variables</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left">
                      <th className="px-4 py-2 font-semibold text-slate-900 dark:text-white">Variable</th>
                      <th className="px-4 py-2 font-semibold text-slate-900 dark:text-white">Required</th>
                      <th className="px-4 py-2 font-semibold text-slate-900 dark:text-white">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    <tr>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">SCREENSHOTAPI_KEY</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">Yes</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">Your API key (sk_live_... or sk_test_...)</td>
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">SCREENSHOTAPI_URL</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">No</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">API base URL (default: https://api.screenshotapi.tech)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              Full source code and documentation:{" "}
              <a
                href="https://github.com/dhanavathsrikanth/screenshotapi-mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-600 underline-offset-2 hover:underline dark:text-indigo-400"
              >
                github.com/dhanavathsrikanth/screenshotapi-mcp
              </a>
            </p>
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
