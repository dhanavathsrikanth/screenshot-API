import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

const screenshotOptionsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    url: { type: "string", format: "uri", description: "Website URL to screenshot. Scheme-less URLs are auto-prefixed with https://." },
    html: { type: "string", description: "Raw HTML to render instead of a URL." },
    markdown: { type: "string", description: "Markdown to render instead of a URL or HTML." },
    format: { type: "string", enum: ["png", "jpeg", "webp", "pdf", "gif", "tiff", "avif", "svg", "html", "mp4", "webm"], default: "png" },
    quality: { type: "integer", minimum: 1, maximum: 100, default: 80 },
    viewport_width: { type: "integer", minimum: 320, maximum: 5000, default: 1280 },
    viewport_height: { type: "integer", minimum: 200, maximum: 5000, default: 720 },
    device_scale_factor: { type: "integer", minimum: 1, maximum: 3, default: 1 },
    full_page: { type: "boolean", default: false },
    block_ads: { type: "boolean", default: true },
    block_cookie_banners: { type: "boolean", default: true },
    block_chats: { type: "boolean", default: true },
    block_trackers: { type: "boolean", default: true },
    block_images: { type: "boolean", default: false },
    block_fonts: { type: "boolean", default: false },
    block_media: { type: "boolean", default: false },
    block_stylesheets: { type: "boolean", default: false },
    block_scripts: { type: "boolean", default: false },
    block_xhr: { type: "boolean", default: false },
    block_fetch: { type: "boolean", default: false },
    block_websocket: { type: "boolean", default: false },
    block_manifest: { type: "boolean", default: false },
    block_other: { type: "boolean", default: false },
    block_domains: { type: "string", description: "Comma-separated domains to block." },
    block_url_patterns: { type: "string", description: "Comma-separated URL patterns to block." },
    dark_mode: { type: "boolean", default: false },
    reduced_motion: { type: "boolean", default: false, description: "Emulate prefers-reduced-motion: reduce." },
    omit_background: { type: "boolean", default: false },
    selector: { type: "string", description: "CSS selector to capture a specific element." },
    hide_selectors: { type: "string", description: "Comma-separated CSS selectors to hide." },
    readiness: { type: "string", enum: ["fast", "balanced", "complete", "custom"], description: "Readiness strategy: fast (domready), balanced (load+idle), complete (2s after load), custom." },
    wait_for_selector: { type: "string", description: "CSS selector to wait for before capture (custom readiness)." },
    wait_for_condition: { type: "string", description: "JavaScript expression to evaluate for readiness (custom readiness)." },
    user_agent: { type: "string", description: "Custom User-Agent string." },
    is_mobile: { type: "boolean", default: false, description: "Emulate mobile device (touch events, viewport meta)." },
    has_touch: { type: "boolean", default: false, description: "Enable touch event emulation." },
    styles: { type: "string", description: "Custom CSS to inject." },
    style_url: { type: "string", format: "uri" },
    style_path: { type: "string" },
    scripts: { type: "string", description: "Custom JavaScript to execute." },
    script_url: { type: "string", format: "uri" },
    script_path: { type: "string" },
    click: { type: "string", description: "CSS selector to click before capture." },
    delay: { type: "integer", minimum: 0, maximum: 1000, default: 0, description: "Delay before capture (ms). Max 1000." },
    timeout: { type: "integer", minimum: 1000, default: 10000, description: "Navigation timeout (ms)." },
    proxy: { type: "string", description: "Proxy URL applied to the whole page." },
    proxy_per_request: { type: "string", description: "Proxy URL applied per resource request." },
    proxy_skip_images: { type: "boolean", default: false },
    proxy_skip_fonts: { type: "boolean", default: false },
    proxy_skip_media: { type: "boolean", default: false },
    proxy_skip_stylesheets: { type: "boolean", default: false },
    country: { type: "string", pattern: "^[A-Za-z]{2}$", description: "ISO 3166-1 alpha-2 country code. Renders through a residential exit IP in that country (e.g. US, DE, JP). Pro plan and above; billed at 2x credits." },
    video_seconds: { type: "integer", minimum: 1, maximum: 30, description: "Record the page for N seconds (1–30) and encode as MP4, WebM, or animated GIF. Required when format is mp4/webm; optional for gif. Scale plan only." },
    video_fps: { type: "integer", minimum: 1, maximum: 30, default: 5, description: "Frame rate for video captures (1–30 fps, default 5)." },
    video_speed: { type: "integer", minimum: 1, maximum: 4, default: 1, description: "Playback speed multiplier for video captures (1–4×, default 1×)." },
    capture_beyond_viewport: { type: "boolean", default: true },
    from_surface: { type: "boolean", default: true },
    pdf_format: { type: "string", enum: ["a4", "a3", "a2", "a1", "a0", "legal", "letter", "tabloid"] },
    pdf_print_background: { type: "boolean", default: true },
    pdf_margin_top: { type: "string" },
    pdf_margin_right: { type: "string" },
    pdf_margin_bottom: { type: "string" },
    pdf_margin_left: { type: "string" },
    full_page_scroll_by: { type: "integer", default: 0 },
    full_page_scroll_delay: { type: "integer", minimum: 0, maximum: 1000, default: 50, description: "Delay between scroll steps (ms)." },
    thumbnail_width: { type: "integer", minimum: 1, maximum: 5000, description: "Resize the output image to this width (sharp pipeline)." },
    thumbnail_height: { type: "integer", minimum: 1, maximum: 5000, description: "Resize the output image to this height." },
    thumbnail_fit: { type: "string", enum: ["cover", "contain", "fill", "inside", "outside"], default: "inside" },
    cookies: {
      type: "array",
      maxItems: 25,
      description: "Cookies seeded into the browser context before navigation (URL captures only). domain defaults to the target hostname, path to '/', secure to https targets.",
      items: { $ref: "#/components/schemas/Cookie" },
    },
    headers: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Custom HTTP headers sent with every request the page makes (navigation and subresources).",
    },
    auth_username: { type: "string", maxLength: 256, description: "HTTP basic auth username. Responds to 401 challenges automatically." },
    auth_password: { type: "string", maxLength: 1024, description: "HTTP basic auth password." },
    wait_until: { type: "string", enum: ["load", "domcontentloaded", "networkidle0", "networkidle2"], description: "When to consider navigation complete." },
    pdfPages: { type: "integer", minimum: 1, default: 1, description: "Internal — used for credit calculation." },
  },
} as const;

const screenshotResultSchema = {
  type: "object",
  properties: {
    url: { type: ["string", "null"], description: "Public storage URL of the screenshot. Null when upload is unavailable." },
    format: { type: "string" },
    width: { type: "integer" },
    height: { type: "integer" },
    size: { type: "integer", description: "File size in bytes." },
    cached: { type: "boolean" },
  },
} as const;

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string", examples: ["invalid_parameters", "unauthorized", "insufficient_credits", "rate_limited", "internal_error"] },
        message: { type: "string" },
        requestId: { type: "string", description: "Correlate with logs; also returned in the X-Request-Id header." },
        details: { type: "object", description: "Extra context (e.g. field-level validation errors)." },
      },
      required: ["code", "message"],
    },
  },
  required: ["error"],
} as const;

export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: `${siteConfig.name} API`,
      version: "1.0.0",
      description:
        "Render website screenshots in one simple API call. Block cookie banners, ads, and chat widgets. Full-page, high-resolution, dark mode, PDF, and more.",
      contact: { email: siteConfig.email },
    },
    servers: [{ url: siteConfig.apiUrl }],
    tags: [{ name: "Screenshots" }, { name: "Operations" }, { name: "Webhooks" }],
    paths: {
      "/api/take": {
        get: {
          tags: ["Screenshots"],
          summary: "Capture a screenshot",
          description:
            "Renders a website (or HTML/markdown) and returns the image/PDF bytes directly. Parameters are sent as query string. Requires authentication.",
          operationId: "takeScreenshotGet",
          parameters: [
            {
              in: "query",
              name: "url",
              schema: { type: "string", format: "uri" },
              required: true,
              description: "The URL to screenshot (url, html, or markdown required).",
            },
            {
              in: "query",
              name: "html",
              schema: { type: "string" },
              description: "Raw HTML to render instead of a URL.",
            },
            {
              in: "query",
              name: "markdown",
              schema: { type: "string" },
              description: "Markdown to render instead of a URL or HTML.",
            },
            {
              in: "query",
              name: "format",
              schema: { type: "string", enum: screenshotOptionsSchema.properties.format.enum, default: "png" },
              description: "Output format.",
            },
            {
              in: "query",
              name: "quality",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 80 },
              description: "JPEG/WebP quality (1–100).",
            },
            {
              in: "query",
              name: "full_page",
              schema: { type: "boolean" },
              description: "Capture the full scrollable page.",
            },
            {
              in: "query",
              name: "viewport_width",
              schema: { type: "integer", minimum: 320, maximum: 5000 },
              description: "Viewport width in px (320–5000).",
            },
            {
              in: "query",
              name: "viewport_height",
              schema: { type: "integer", minimum: 200, maximum: 5000 },
              description: "Viewport height in px (200–5000).",
            },
            {
              in: "query",
              name: "device_scale_factor",
              schema: { type: "integer", minimum: 1, maximum: 3 },
              description: "Device scale factor (1–3).",
            },
            {
              in: "query",
              name: "dark_mode",
              schema: { type: "boolean" },
              description: "Emulate prefers-color-scheme: dark.",
            },
            {
              in: "query",
              name: "reduced_motion",
              schema: { type: "boolean" },
              description: "Emulate prefers-reduced-motion: reduce.",
            },
            {
              in: "query",
              name: "block_ads",
              schema: { type: "boolean" },
              description: "Block ad-related requests.",
            },
            {
              in: "query",
              name: "block_cookie_banners",
              schema: { type: "boolean" },
              description: "Block cookie consent banners.",
            },
            {
              in: "query",
              name: "block_chats",
              schema: { type: "boolean" },
              description: "Block live-chat widgets.",
            },
            {
              in: "query",
              name: "block_trackers",
              schema: { type: "boolean" },
              description: "Block tracking scripts.",
            },
            {
              in: "query",
              name: "block_images",
              schema: { type: "boolean" },
              description: "Block image loading.",
            },
            {
              in: "query",
              name: "block_fonts",
              schema: { type: "boolean" },
              description: "Block font loading.",
            },
            {
              in: "query",
              name: "block_media",
              schema: { type: "boolean" },
              description: "Block media (video/audio) loading.",
            },
            {
              in: "query",
              name: "block_stylesheets",
              schema: { type: "boolean" },
              description: "Block stylesheet loading.",
            },
            {
              in: "query",
              name: "block_scripts",
              schema: { type: "boolean" },
              description: "Block script loading.",
            },
            {
              in: "query",
              name: "selector",
              schema: { type: "string" },
              description: "CSS selector to capture a specific element.",
            },
            {
              in: "query",
              name: "hide_selectors",
              schema: { type: "string" },
              description: "Comma-separated CSS selectors to hide.",
            },
            {
              in: "query",
              name: "click",
              schema: { type: "string" },
              description: "CSS selector to click before capture.",
            },
            {
              in: "query",
              name: "delay",
              schema: { type: "integer", minimum: 0, maximum: 1000 },
              description: "Delay before capture in ms (max 1000).",
            },
            {
              in: "query",
              name: "timeout",
              schema: { type: "integer", minimum: 1000, default: 10000 },
              description: "Navigation timeout in ms.",
            },
            {
              in: "query",
              name: "wait_until",
              schema: { type: "string", enum: ["load", "domcontentloaded", "networkidle0", "networkidle2"] },
              description: "When to consider navigation complete.",
            },
            {
              in: "query",
              name: "readiness",
              schema: { type: "string", enum: ["fast", "balanced", "complete", "custom"] },
              description: "Readiness strategy.",
            },
            {
              in: "query",
              name: "wait_for_selector",
              schema: { type: "string" },
              description: "CSS selector to wait for before capture.",
            },
            {
              in: "query",
              name: "proxy",
              schema: { type: "string" },
              description: "Proxy URL for the whole page.",
            },
            {
              in: "query",
              name: "country",
              schema: { type: "string", pattern: "^[A-Za-z]{2}$" },
              description: "ISO 3166-1 alpha-2 country code. Renders through a residential exit IP in that country. Pro plan and above; billed at 2x credits.",
            },
            {
              in: "query",
              name: "video_seconds",
              schema: { type: "integer", minimum: 1, maximum: 30 },
              description: "Record the page for N seconds (1–30) and encode as MP4, WebM, or animated GIF. Required when format is mp4 or webm; optional for gif (omit for a static single-frame gif). Scale plan only.",
            },
            {
              in: "query",
              name: "video_fps",
              schema: { type: "integer", minimum: 1, maximum: 30, default: 5 },
              description: "Frame rate for video captures (1–30 fps, default 5).",
            },
            {
              in: "query",
              name: "video_speed",
              schema: { type: "integer", minimum: 1, maximum: 4, default: 1 },
              description: "Playback speed multiplier for video captures (1–4×, default 1×).",
            },
            {
              in: "query",
              name: "styles",
              schema: { type: "string" },
              description: "Custom CSS to inject.",
            },
            {
              in: "query",
              name: "scripts",
              schema: { type: "string" },
              description: "Custom JavaScript to execute.",
            },
            {
              in: "query",
              name: "user_agent",
              schema: { type: "string" },
              description: "Custom User-Agent string.",
            },
            {
              in: "query",
              name: "is_mobile",
              schema: { type: "boolean" },
              description: "Emulate mobile device.",
            },
            {
              in: "query",
              name: "has_touch",
              schema: { type: "boolean" },
              description: "Enable touch events.",
            },
            {
              in: "query",
              name: "thumbnail_width",
              schema: { type: "integer", minimum: 1 },
              description: "Resize output to this width.",
            },
            {
              in: "query",
              name: "thumbnail_height",
              schema: { type: "integer", minimum: 1 },
              description: "Resize output to this height.",
            },
            {
              in: "query",
              name: "thumbnail_fit",
              schema: { type: "string", enum: ["cover", "contain", "fill", "inside", "outside"] },
              description: "How the resized image fits its target box.",
            },
            {
              in: "query",
              name: "cookies",
              schema: { type: "string" },
              description: "JSON-encoded array of cookie objects ({name, value, domain?, path?, expires?, http_only?, secure?, same_site?}) seeded before navigation.",
            },
            {
              in: "query",
              name: "headers",
              schema: { type: "string" },
              description: "JSON-encoded object of custom HTTP headers sent with every page request.",
            },
            {
              in: "query",
              name: "auth_username",
              schema: { type: "string" },
              description: "HTTP basic auth username.",
            },
            {
              in: "query",
              name: "auth_password",
              schema: { type: "string" },
              description: "HTTP basic auth password.",
            },
            {
              in: "query",
              name: "pdf_format",
              schema: { type: "string", enum: ["a4", "a3", "a2", "a1", "a0", "legal", "letter", "tabloid"] },
              description: "PDF page format.",
            },
            {
              in: "query",
              name: "full_page_scroll_by",
              schema: { type: "integer", default: 0 },
              description: "Scroll step size for full-page capture.",
            },
            {
              in: "query",
              name: "full_page_scroll_delay",
              schema: { type: "integer", minimum: 0, maximum: 1000, default: 50 },
              description: "Delay between scroll steps in ms.",
            },
          ],
          responses: {
            "200": {
              description: "Screenshot bytes.",
              content: {
                "image/png": { schema: { type: "string", format: "binary" } },
                "image/jpeg": { schema: { type: "string", format: "binary" } },
                "image/webp": { schema: { type: "string", format: "binary" } },
                "application/pdf": { schema: { type: "string", format: "binary" } },
              },
              headers: {
                "X-Request-Id": { schema: { type: "string" } },
                "X-Cache": { schema: { type: "string", enum: ["HIT", "MISS"] } },
                "X-Credits-Used": { schema: { type: "integer" } },
                "X-RateLimit-Limit": { schema: { type: "integer" } },
                "X-RateLimit-Remaining": { schema: { type: "integer" } },
                "X-RateLimit-Reset": { schema: { type: "integer" } },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "402": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
            "429": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
        post: {
          tags: ["Screenshots"],
          summary: "Capture a screenshot (JSON body)",
          description:
            "Like GET /api/take but the request body is JSON and the response is a JSON object with a public storage URL.",
          operationId: "takeScreenshotPost",
          requestBody: {
            required: true,
            content: { "application/json": { schema: screenshotOptionsSchema } },
          },
          responses: {
            "200": {
              description: "Screenshot metadata.",
              content: { "application/json": { schema: screenshotResultSchema } },
              headers: {
                "X-Request-Id": { schema: { type: "string" } },
                "X-Cache": { schema: { type: "string", enum: ["HIT", "MISS"] } },
                "X-Credits-Used": { schema: { type: "integer" } },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "402": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
            "429": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/take/bulk": {
        post: {
          tags: ["Screenshots"],
          summary: "Capture multiple URLs",
          description: "Screenshot up to 100 URLs in a single request, with configurable concurrency and retries.",
          operationId: "takeScreenshotBulk",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["urls"],
                  properties: {
                    urls: { type: "array", items: { type: "string", format: "uri" }, minItems: 1, maxItems: 100 },
                    concurrency: { type: "integer", minimum: 1, maximum: 10, default: 3 },
                    max_retries: { type: "integer", minimum: 0, maximum: 5, default: 3 },
                    ...screenshotOptionsSchema.properties,
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Batch results.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      successful: { type: "integer" },
                      failed: { type: "integer" },
                      creditsUsed: { type: "integer" },
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            url: { type: "string" },
                            success: { type: "boolean" },
                            error: { type: ["string", "null"] },
                            statusCode: { type: ["integer", "null"] },
                            durationMs: { type: ["integer", "null"] },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "402": { $ref: "#/components/responses/Error" },
            "429": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/health": {
        get: {
          tags: ["Operations"],
          summary: "Service health",
          description: "Returns 200 when all upstream services are reachable, 503 otherwise.",
          operationId: "health",
          responses: {
            "200": {
              description: "Healthy.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      service: { type: "string" },
                      checks: {
                        type: "object",
                        properties: { redis: { type: "boolean" }, supabase: { type: "boolean" }, storage: { type: "boolean" } },
                      },
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            "503": { $ref: "#/components/responses/Error" },
          },
        },
      },
      "/api/v1/screenshots": {
        post: {
          tags: ["Screenshots"],
          summary: "Capture a screenshot or video (v1)",
          description:
            "Screenshot or video capture with device emulation. Use `device` for full device emulation or `viewport` for responsive testing. Set `format` to mp4/webm/gif and pass `video_seconds` for animated captures (Scale plan).",
          operationId: "v1CreateScreenshot",
          parameters: [
            { in: "query", name: "sync", schema: { type: "boolean" }, description: "If true, wait for the screenshot to complete before responding." },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri", description: "Website URL to screenshot." },
                    html: { type: "string", description: "Raw HTML to render instead of a URL." },
                    markdown: { type: "string", description: "Markdown to render instead of a URL or HTML." },
                    device: {
                      type: "string",
                      enum: ["mobile", "tablet", "desktop"],
                      description: "Device preset. Sets viewport, scale, touch, and user agent automatically. Defaults to desktop.",
                    },
                    viewport: {
                      type: "string",
                      enum: ["mobile_sm", "mobile", "mobile_lg", "tablet", "tablet_lg", "desktop", "desktop_hd"],
                      description: "Standard viewport size. Sets dimensions + scale only (no device emulation). Use for responsive testing.",
                    },
                    width: { type: "integer", minimum: 1, maximum: 5000, description: "Override viewport width (px)." },
                    height: { type: "integer", minimum: 1, maximum: 5000, description: "Override viewport height (px)." },
                    device_scale_factor: { type: "integer", minimum: 1, maximum: 3, description: "Override device scale factor (1–3)." },
                    format: { type: "string", enum: ["png", "jpeg", "webp", "pdf"], default: "png" },
                    quality: { type: "integer", minimum: 1, maximum: 100, default: 80 },
                    full_page: { type: "boolean", default: false },
                    delay: { type: "integer", minimum: 0, description: "Delay before capture (ms)." },
                    wait_for: { type: "string", enum: ["load", "domcontentloaded", "networkidle0", "networkidle2"] },
                    dark_mode: { type: "boolean", default: false },
                    block_ads: { type: "boolean", default: true },
                    block_cookie_banners: { type: "boolean", default: true },
                    block_trackers: { type: "boolean", default: true },
                    block_images: { type: "boolean", default: false },
                    selector: { type: "string", description: "CSS selector to capture a specific element." },
                    timeout: { type: "integer", minimum: 1000, default: 10000 },
                    user_agent: { type: "string", description: "Custom User-Agent string override." },
                    is_mobile: { type: "boolean", description: "Override mobile emulation flag." },
                    has_touch: { type: "boolean", description: "Override touch emulation flag." },
                    country: {
                      type: "string",
                      pattern: "^[A-Za-z]{2}$",
                      description: "ISO 3166-1 alpha-2 country code. Renders through a residential exit IP in that country (e.g. US, DE, JP). Pro plan and above; billed at 2x credits.",
                    },
                    thumbnail_width: { type: "integer", minimum: 1, maximum: 5000, description: "Resize the output image to this width after capture." },
                    thumbnail_height: { type: "integer", minimum: 1, maximum: 5000, description: "Resize the output image to this height after capture." },
                    thumbnail_fit: { type: "string", enum: ["cover", "contain", "fill", "inside", "outside"], description: "How the resized image fits its target box. Defaults to 'inside'." },
                    cookies: {
                      type: "array",
                      maxItems: 25,
                      items: { $ref: "#/components/schemas/Cookie" },
                      description: "Cookies seeded into the browser context before navigation (URL captures only).",
                    },
                    headers: {
                      type: "object",
                      additionalProperties: { type: "string" },
                      description: "Custom HTTP headers sent with every request the page makes.",
                    },
                    auth_username: { type: "string", maxLength: 256, description: "HTTP basic auth username." },
                    auth_password: { type: "string", maxLength: 1024, description: "HTTP basic auth password." },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Screenshot completed (sync mode).",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          status: { type: "string" },
                          cached: { type: "boolean" },
                          screenshot: { $ref: "#/components/schemas/ScreenshotResult" },
                        },
                      },
                    },
                  },
                },
              },
              headers: {
                "X-Request-Id": { schema: { type: "string" } },
                "X-RateLimit-Limit": { schema: { type: "integer" } },
                "X-RateLimit-Remaining": { schema: { type: "integer" } },
                "X-RateLimit-Reset": { schema: { type: "integer" } },
              },
            },
            "202": {
              description: "Screenshot queued (async mode).",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          status: { type: "string" },
                          status_url: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "402": { $ref: "#/components/responses/Error" },
            "403": { $ref: "#/components/responses/Error" },
            "429": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
        get: {
          tags: ["Screenshots"],
          summary: "List screenshots",
          description:
            "Returns a paginated list of screenshot jobs for the authenticated account, newest first. Use the `before` cursor (an ISO 8601 timestamp) to page through results.",
          operationId: "listScreenshots",
          parameters: [
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
              description: "Maximum number of screenshots to return.",
            },
            {
              in: "query",
              name: "before",
              schema: { type: "string", format: "date-time" },
              description: "Cursor returned as `next_cursor` — returns screenshots created before this timestamp.",
            },
          ],
          responses: {
            "200": {
              description: "List of screenshots.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          screenshots: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string" },
                                status: { type: "string", enum: ["queued", "processing", "completed", "failed", "cancelled"] },
                                status_url: { type: "string" },
                                screenshot: { $ref: "#/components/schemas/ScreenshotResult" },
                                error: { type: ["object", "null"] },
                                created_at: { type: "string", format: "date-time" },
                                updated_at: { type: "string", format: "date-time" },
                              },
                            },
                          },
                          pagination: {
                            type: "object",
                            properties: {
                              limit: { type: "integer" },
                              before: { type: ["string", "null"] },
                              next_cursor: { type: ["string", "null"] },
                              has_more: { type: "boolean" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/usage": {
        get: {
          tags: ["Operations"],
          summary: "Get usage",
          description: "Returns plan, quota usage, request counts, and credit balance for the authenticated account.",
          operationId: "getUsage",
          responses: {
            "200": {
              description: "Usage summary.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          plan: { type: "string", enum: ["free", "starter", "pro", "scale"] },
                          period: {
                            type: "object",
                            properties: {
                              start: { type: "string", format: "date-time" },
                              end: { type: "string", format: "date-time" },
                              reset_at: { type: ["string", "null"], format: "date-time" },
                            },
                          },
                          requests: {
                            type: "object",
                            properties: {
                              used: { type: "integer" },
                              limit: { type: "integer" },
                              remaining: { type: "integer" },
                            },
                          },
                          requests_this_window: {
                            type: "object",
                            properties: {
                              total: { type: "integer" },
                              cached: { type: "integer" },
                              cache_hit_rate: { type: "integer" },
                            },
                          },
                          credits: {
                            type: "object",
                            properties: {
                              used_this_cycle: { type: "integer" },
                              granted_this_cycle: { type: "integer" },
                              balance: { type: "integer" },
                              top_up_balance: { type: "integer" },
                              overage_enabled: { type: "boolean" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/webhooks": {
        get: {
          tags: ["Webhooks"],
          summary: "List webhook endpoints",
          description: "Returns all webhook endpoints for the authenticated account.",
          operationId: "listWebhookEndpoints",
          responses: {
            "200": {
              description: "Webhook endpoints.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          webhooks: { type: "array", items: { $ref: "#/components/schemas/WebhookEndpoint" } },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
        post: {
          tags: ["Webhooks"],
          summary: "Create a webhook endpoint",
          description:
            "Creates a webhook endpoint and returns it together with its signing secret. Deliveries are signed with HMAC-SHA256 and sent in the `x-webhook-signature` header as `t=<unix_ms>,v1=<hex>`.",
          operationId: "createWebhookEndpoint",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["url"],
                  properties: {
                    url: { type: "string", format: "uri", description: "HTTPS endpoint that receives the webhook." },
                    events: {
                      type: "array",
                      items: { type: "string", enum: ["screenshot.completed", "screenshot.failed", "job.started", "quota.exceeded"] },
                      default: ["screenshot.completed", "screenshot.failed"],
                      description: "Events to subscribe to. Defaults to all events.",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Webhook endpoint created. Save the signing secret — it is only shown once.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        allOf: [{ $ref: "#/components/schemas/WebhookEndpoint" }],
                        properties: {
                          secret: { type: "string", description: "Signing secret. Only returned on creation." },
                          signing_secret: { type: "string", description: "Alias of `secret`." },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/webhooks/{id}": {
        get: {
          tags: ["Webhooks"],
          summary: "Get a webhook endpoint",
          description: "Returns a single webhook endpoint with its 25 most recent deliveries.",
          operationId: "getWebhookEndpoint",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Webhook endpoint with deliveries.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        allOf: [{ $ref: "#/components/schemas/WebhookEndpoint" }],
                        properties: {
                          deliveries: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
        patch: {
          tags: ["Webhooks"],
          summary: "Update a webhook endpoint",
          description:
            "Updates the URL, subscribed events, or active state of an endpoint. Set `rotate_secret` to `true` to generate a new signing secret.",
          operationId: "updateWebhookEndpoint",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: { type: "string", format: "uri" },
                    events: {
                      type: "array",
                      items: { type: "string", enum: ["screenshot.completed", "screenshot.failed", "job.started", "quota.exceeded"] },
                      minItems: 1,
                    },
                    is_active: { type: "boolean", description: "Pause (false) or resume (true) deliveries." },
                    rotate_secret: { type: "boolean", description: "Generate a new signing secret." },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated endpoint. `signing_secret` is present only when rotated.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        allOf: [{ $ref: "#/components/schemas/WebhookEndpoint" }],
                        properties: {
                          signing_secret: { type: ["string", "null"] },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
        delete: {
          tags: ["Webhooks"],
          summary: "Delete a webhook endpoint",
          description: "Deletes the endpoint and its delivery history.",
          operationId: "deleteWebhookEndpoint",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Deleted.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: { id: { type: "string" }, deleted: { type: "boolean" } },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/webhooks/deliveries": {
        get: {
          tags: ["Webhooks"],
          summary: "List webhook deliveries",
          description: "Returns recent webhook delivery attempts. Optionally filter by `endpoint_id`.",
          operationId: "listWebhookDeliveries",
          parameters: [
            { in: "query", name: "endpoint_id", schema: { type: "string" }, description: "Filter by endpoint." },
            { in: "query", name: "limit", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          ],
          responses: {
            "200": {
              description: "Deliveries.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          deliveries: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/webhooks/{id}/test": {
        post: {
          tags: ["Webhooks"],
          summary: "Send a test webhook",
          description: "Queues a signed `webhook.test` delivery to the endpoint with a synthetic payload. Useful for verifying your endpoint handles signature verification and returns 200.",
          operationId: "sendWebhookTest",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Test delivery queued.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: { delivery_id: { type: "string" } },
                      },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/webhooks/deliveries/{deliveryId}/replay": {
        post: {
          tags: ["Webhooks"],
          summary: "Replay a webhook delivery",
          description: "Re-enqueues a previously failed or delivered webhook with the original payload and event type.",
          operationId: "replayWebhookDelivery",
          parameters: [{ in: "path", name: "deliveryId", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Delivery re-enqueued.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          status: { type: "string", enum: ["pending"] },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/screenshots/{id}/share": {
        post: {
          tags: ["Screenshots"],
          summary: "Create a share link",
          description: "Creates an expiring, unauthenticated capability URL for a screenshot. Defaults to 7 days; maximum 30 days.",
          operationId: "createScreenshotShare",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" }, description: "Screenshot or capture job id." }],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    expires_in_days: { type: "integer", minimum: 1, maximum: 30, default: 7, description: "Link lifetime in days." },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Share link created.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          url: { type: "string", description: "Public share URL (relative to API root)." },
                          expires_at: { type: "string", format: "date-time" },
                        },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/api-keys": {
        get: {
          tags: ["API Keys"],
          summary: "List API keys",
          description: "Returns all API keys for the authenticated user. Secrets are never returned.",
          operationId: "listApiKeys",
          responses: {
            "200": {
              description: "API keys.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "array", items: { $ref: "#/components/schemas/ApiKey" } },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
        post: {
          tags: ["API Keys"],
          summary: "Create an API key",
          description:
            "Creates a new API key. The full secret is only returned once — store it securely. Optionally set a per-key rate limit or expiration.",
          operationId: "createApiKey",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string", minLength: 1, maxLength: 80 },
                    environment: { type: "string", enum: ["production", "development", "preview", "local"], default: "production" },
                    project_id: { type: "string" },
                    rate_limit_per_minute: { type: "integer", minimum: 0, maximum: 10000, description: "Per-key requests/minute override. 0 or omit = plan default." },
                    expires_in_days: { type: "integer", minimum: 1, maximum: 365, description: "Auto-expire after this many days. Omit = never." },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "API key created. The `key` field contains the full secret.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        allOf: [{ $ref: "#/components/schemas/ApiKey" }],
                        properties: { key: { type: "string", description: "Full API key secret. Only shown on creation." } },
                      },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
      "/api/v1/api-keys/{id}": {
        get: {
          tags: ["API Keys"],
          summary: "Get an API key",
          description: "Returns a single API key by id.",
          operationId: "getApiKey",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "API key details.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ApiKey" },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
        patch: {
          tags: ["API Keys"],
          summary: "Update an API key",
          description: "Update a key's name, active state, per-key rate limit, or expiration. Set `rate_limit_per_minute` to 0 or null to clear (plan default). Set `expires_in_days` to null to remove expiry.",
          operationId: "updateApiKey",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", minLength: 1, maxLength: 80 },
                    is_active: { type: "boolean" },
                    rate_limit_per_minute: { type: "integer", minimum: 0, maximum: 10000, nullable: true },
                    expires_in_days: { type: "integer", minimum: 1, maximum: 365, nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated API key.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { $ref: "#/components/schemas/ApiKey" },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/Error" },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
        delete: {
          tags: ["API Keys"],
          summary: "Delete an API key",
          description: "Permanently deletes the API key.",
          operationId: "deleteApiKey",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Deleted.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: { id: { type: "string" }, deleted: { type: "boolean" } },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Error" },
            "404": { $ref: "#/components/responses/Error" },
            "500": { $ref: "#/components/responses/Error" },
          },
          security: [{ apiKey: [] }],
        },
      },
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          description:
            "API key created in the dashboard. Send it as `Authorization: Bearer <key>` or in the `X-Api-Key` header.",
        },
      },
      schemas: {
        ScreenshotOptions: screenshotOptionsSchema,
        ScreenshotResult: screenshotResultSchema,
        Cookie: {
          type: "object",
          required: ["name", "value"],
          properties: {
            name: { type: "string", maxLength: 128 },
            value: { type: "string", maxLength: 4096 },
            domain: { type: "string", description: "Defaults to the target URL's hostname." },
            path: { type: "string", description: "Defaults to '/'." },
            expires: { type: "integer", description: "Unix timestamp (seconds) after which the cookie expires." },
            http_only: { type: "boolean" },
            secure: { type: "boolean", description: "Defaults to true for https targets." },
            same_site: { type: "string", enum: ["Strict", "Lax", "None"] },
          },
        },
        WebhookEndpoint: {
          type: "object",
          properties: {
            id: { type: "string" },
            url: { type: "string", format: "uri" },
            events: {
              type: "array",
              items: { type: "string", enum: ["screenshot.completed", "screenshot.failed", "job.started", "quota.exceeded"] },
            },
            is_active: { type: "boolean" },
            project_id: { type: ["string", "null"] },
            created_at: { type: "string", format: "date-time" },
            updated_at: { type: "string", format: "date-time" },
          },
        },
        ApiKey: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            key_prefix: { type: "string", description: "Non-secret prefix for display (e.g. 'sk_prod_')." },
            environment: { type: "string", enum: ["production", "development", "preview", "local"] },
            project_id: { type: ["string", "null"] },
            is_active: { type: "boolean" },
            rate_limit_per_minute: { type: ["integer", "null"], description: "Per-key override. null = plan default." },
            expires_at: { type: ["string", "null"], format: "date-time", description: "null = never expires." },
            last_used_at: { type: ["string", "null"], format: "date-time" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        WebhookDelivery: {
          type: "object",
          properties: {
            id: { type: "string" },
            endpoint_id: { type: "string" },
            event: { type: "string", enum: ["screenshot.completed", "screenshot.failed"] },
            status: { type: "string", enum: ["pending", "delivering", "delivered", "failed"] },
            attempts: { type: "integer" },
            http_status: { type: ["integer", "null"] },
            error: { type: ["string", "null"] },
            next_retry_at: { type: ["string", "null"], format: "date-time" },
            created_at: { type: "string", format: "date-time" },
            sent_at: { type: ["string", "null"], format: "date-time" },
          },
        },
        Error: errorSchema,
      },
      responses: {
        Error: {
          description: "Error response.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
        },
      },
    },
  };

  return Response.json(spec, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
