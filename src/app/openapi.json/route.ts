import { siteConfig } from "@/lib/site";

export const dynamic = "force-dynamic";

const screenshotOptionsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    url: { type: "string", format: "uri", description: "Website URL to screenshot. Scheme-less URLs are auto-prefixed with https://." },
    html: { type: "string", description: "Raw HTML to render instead of a URL." },
    markdown: { type: "string", description: "Markdown to render instead of a URL or HTML." },
    format: { type: "string", enum: ["png", "jpeg", "webp", "pdf", "gif", "tiff", "avif", "svg", "html"], default: "png" },
    quality: { type: "integer", minimum: 1, maximum: 100, default: 80 },
    viewport_width: { type: "integer", minimum: 1, default: 1280 },
    viewport_height: { type: "integer", minimum: 1, default: 720 },
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
    reduced_motion: { type: "boolean", default: false },
    omit_background: { type: "boolean", default: false },
    selector: { type: "string", description: "CSS selector to capture a specific element." },
    hide_selectors: { type: "string", description: "Comma-separated CSS selectors to hide." },
    styles: { type: "string", description: "Custom CSS to inject." },
    style_url: { type: "string", format: "uri" },
    style_path: { type: "string" },
    scripts: { type: "string", description: "Custom JavaScript to execute." },
    script_url: { type: "string", format: "uri" },
    script_path: { type: "string" },
    click: { type: "string", description: "CSS selector to click before capture." },
    delay: { type: "integer", minimum: 0, default: 0, description: "Delay before capture (ms)." },
    timeout: { type: "integer", minimum: 1000, default: 10000, description: "Navigation timeout (ms)." },
    proxy: { type: "string", description: "Proxy URL applied to the whole page." },
    proxy_per_request: { type: "string", description: "Proxy URL applied per resource request." },
    proxy_skip_images: { type: "boolean", default: false },
    proxy_skip_fonts: { type: "boolean", default: false },
    proxy_skip_media: { type: "boolean", default: false },
    proxy_skip_stylesheets: { type: "boolean", default: false },
    capture_beyond_viewport: { type: "boolean", default: true },
    from_surface: { type: "boolean", default: true },
    pdf_format: { type: "string", enum: ["a4", "a3", "a2", "a1", "a0", "legal", "letter", "tabloid"] },
    pdf_print_background: { type: "boolean", default: true },
    pdf_margin_top: { type: "string" },
    pdf_margin_right: { type: "string" },
    pdf_margin_bottom: { type: "string" },
    pdf_margin_left: { type: "string" },
    full_page_scroll_by: { type: "integer", default: 0 },
    full_page_scroll_delay: { type: "integer", default: 100 },
    thumbnail_width: { type: "integer", minimum: 1 },
    thumbnail_height: { type: "integer", minimum: 1 },
    thumbnail_fit: { type: "string", enum: ["cover", "contain", "fill", "inside", "outside"], default: "inside" },
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
    servers: [{ url: siteConfig.url }],
    tags: [{ name: "Screenshots" }, { name: "Operations" }],
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
              name: "format",
              schema: { type: "string", enum: screenshotOptionsSchema.properties.format.enum, default: "png" },
              description: "Output format.",
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
              schema: { type: "integer" },
              description: "Viewport width in px.",
            },
            {
              in: "query",
              name: "viewport_height",
              schema: { type: "integer" },
              description: "Viewport height in px.",
            },
            {
              in: "query",
              name: "dark_mode",
              schema: { type: "boolean" },
              description: "Emulate prefers-color-scheme: dark.",
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
