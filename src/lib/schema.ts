import { z } from "zod";

const WaitUntilSchema = z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional();
const SetContentWaitUntilSchema = z.enum(["load", "domcontentloaded"]).optional();

/**
 * A single cookie to seed the browser context with before navigation.
 * `domain` defaults to the target URL's hostname and `path` to "/" when omitted.
 */
export const CookieSchema = z.object({
  name: z.string().min(1).max(128),
  value: z.string().max(4096),
  domain: z.string().max(253).optional(),
  path: z.string().max(1024).optional(),
  /** Unix timestamp (seconds) after which the browser drops the cookie. */
  expires: z.coerce.number().int().optional(),
  http_only: z.coerce.boolean().optional(),
  secure: z.coerce.boolean().optional(),
  same_site: z.enum(["Strict", "Lax", "None"]).optional(),
});

export type Cookie = z.infer<typeof CookieSchema>;

/** Query-string-friendly: accept a JSON-encoded string and parse it once. */
function parseJsonEncoded(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      // Leave as-is so the inner schema reports a precise validation error.
      return raw;
    }
  }
  return raw;
}

export const ScreenshotOptionsSchema = z.object({
  url: z.string().url().optional(),
  html: z.string().optional(),
  markdown: z.string().optional(),
  format: z.enum(["png", "jpeg", "webp", "pdf", "gif", "tiff", "avif", "svg", "html", "mp4", "webm"]).default("png"),
  quality: z.coerce.number().int().min(1).max(100).default(80),
  viewport_width: z.coerce.number().int().min(320).max(5000).default(1280),
  viewport_height: z.coerce.number().int().min(200).max(5000).default(720),
  device_scale_factor: z.coerce.number().int().min(1).max(3).default(1),
  full_page: z.coerce.boolean().default(false),
  block_ads: z.coerce.boolean().default(true),
  block_cookie_banners: z.coerce.boolean().default(true),
  block_chats: z.coerce.boolean().default(true),
  block_trackers: z.coerce.boolean().default(true),
  block_images: z.coerce.boolean().default(false),
  block_fonts: z.coerce.boolean().default(false),
  block_media: z.coerce.boolean().default(false),
  block_stylesheets: z.coerce.boolean().default(false),
  block_scripts: z.coerce.boolean().default(false),
  block_xhr: z.coerce.boolean().default(false),
  block_fetch: z.coerce.boolean().default(false),
  block_websocket: z.coerce.boolean().default(false),
  block_manifest: z.coerce.boolean().default(false),
  block_other: z.coerce.boolean().default(false),
  block_domains: z.string().optional(),
  block_url_patterns: z.string().optional(),
  dark_mode: z.coerce.boolean().default(false),
  reduced_motion: z.coerce.boolean().default(false),
  omit_background: z.coerce.boolean().default(false),
  selector: z.string().optional(),
  hide_selectors: z.string().optional(),
  // Readiness strategy + custom readiness knobs (blueprint §9)
  readiness: z.enum(["fast", "balanced", "complete", "custom"]).optional(),
  wait_for_selector: z.string().optional(),
  wait_for_condition: z.string().optional(),
  // Device emulation (blueprint §27)
  user_agent: z.string().optional(),
  is_mobile: z.coerce.boolean().default(false),
  has_touch: z.coerce.boolean().default(false),
  styles: z.string().optional(),
  style_url: z.string().url().optional(),
  style_path: z.string().optional(),
  scripts: z.string().optional(),
  script_url: z.string().url().optional(),
  script_path: z.string().optional(),
  click: z.string().optional(),
  delay: z.coerce.number().int().min(0).max(1000).default(0),
  timeout: z.coerce.number().int().min(1000).default(10000),
  proxy: z.string().optional(),
  proxy_per_request: z.string().optional(),
  proxy_skip_images: z.coerce.boolean().default(false),
  proxy_skip_fonts: z.coerce.boolean().default(false),
  proxy_skip_media: z.coerce.boolean().default(false),
  proxy_skip_stylesheets: z.coerce.boolean().default(false),
  // Geo-targeting: render through a residential exit IP in this country
  // (ISO 3166-1 alpha-2). Normalized to uppercase; resolved to a gateway
  // proxy at render time so the result cache key stays deterministic.
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/, {
      message: "country must be a 2-letter ISO 3166-1 alpha-2 code (e.g. US, DE, JP).",
    })
    .transform((v) => v.toUpperCase())
    .optional(),
  capture_beyond_viewport: z.coerce.boolean().default(true),
  from_surface: z.coerce.boolean().default(true),
  pdf_format: z.enum(["a4", "a3", "a2", "a1", "a0", "legal", "letter", "tabloid"]).optional(),
  pdf_print_background: z.coerce.boolean().default(true),
  pdf_margin_top: z.string().optional(),
  pdf_margin_right: z.string().optional(),
  pdf_margin_bottom: z.string().optional(),
  pdf_margin_left: z.string().optional(),
  full_page_scroll_by: z.coerce.number().int().default(0),
  full_page_scroll_delay: z.coerce.number().int().min(0).max(1000).default(50),
  thumbnail_width: z.coerce.number().int().min(1).max(5000).optional(),
  thumbnail_height: z.coerce.number().int().min(1).max(5000).optional(),
  thumbnail_fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).default("inside"),
  // Authenticated-page rendering: seed cookies, custom HTTP headers (sent
  // with every request the page makes), and HTTP basic auth credentials.
  // Accepts native JSON or a JSON-encoded string (query-string friendly).
  cookies: z.preprocess(parseJsonEncoded, z.array(CookieSchema).max(25).optional()),
  headers: z.preprocess(parseJsonEncoded, z.record(z.string(), z.string()).optional()),
  auth_username: z.string().max(256).optional(),
  auth_password: z.string().max(1024).optional(),
  wait_until: WaitUntilSchema,
  // pdfPages is used for credit calculation - actual page count may differ after rendering
  pdfPages: z.coerce.number().int().min(1).default(1),
  // Video capture (Scale plan): record the page for N seconds, encode via CDP + ffmpeg.
  video_seconds: z.coerce.number().int().min(1).max(30).optional(),
  video_fps: z.coerce.number().int().min(1).max(30).default(5),
  video_speed: z.coerce.number().int().min(1).max(4).default(1),
});

export const BulkScreenshotSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(100),
  concurrency: z.coerce.number().int().min(1).max(10).default(3),
  max_retries: z.coerce.number().int().min(0).max(5).default(3),
  ...ScreenshotOptionsSchema.shape,
});

export type ScreenshotOptions = z.infer<typeof ScreenshotOptionsSchema>;
export type BulkScreenshotOptions = z.infer<typeof BulkScreenshotSchema>;

export const ScreenshotResponseSchema = z.object({
  url: z.string().url(),
  format: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  size: z.number().int(),
  cached: z.boolean(),
});

export type ScreenshotResponse = z.infer<typeof ScreenshotResponseSchema>;
