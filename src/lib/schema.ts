import { z } from "zod";

const WaitUntilSchema = z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional();
const SetContentWaitUntilSchema = z.enum(["load", "domcontentloaded"]).optional();

export const ScreenshotOptionsSchema = z.object({
  url: z.string().url().optional(),
  html: z.string().optional(),
  markdown: z.string().optional(),
  format: z.enum(["png", "jpeg", "webp", "pdf", "gif", "tiff", "avif", "svg", "html"]).default("png"),
  quality: z.coerce.number().int().min(1).max(100).default(80),
  viewport_width: z.coerce.number().int().min(1).default(1280),
  viewport_height: z.coerce.number().int().min(1).default(720),
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
  styles: z.string().optional(),
  style_url: z.string().url().optional(),
  style_path: z.string().optional(),
  scripts: z.string().optional(),
  script_url: z.string().url().optional(),
  script_path: z.string().optional(),
  click: z.string().optional(),
  delay: z.coerce.number().int().min(0).default(0),
  timeout: z.coerce.number().int().min(1000).default(30000),
  proxy: z.string().optional(),
  proxy_per_request: z.string().optional(),
  proxy_skip_images: z.coerce.boolean().default(false),
  proxy_skip_fonts: z.coerce.boolean().default(false),
  proxy_skip_media: z.coerce.boolean().default(false),
  proxy_skip_stylesheets: z.coerce.boolean().default(false),
  capture_beyond_viewport: z.coerce.boolean().default(true),
  from_surface: z.coerce.boolean().default(true),
  pdf_format: z.enum(["a4", "a3", "a2", "a1", "a0", "legal", "letter", "tabloid"]).optional(),
  pdf_print_background: z.coerce.boolean().default(true),
  pdf_margin_top: z.string().optional(),
  pdf_margin_right: z.string().optional(),
  pdf_margin_bottom: z.string().optional(),
  pdf_margin_left: z.string().optional(),
  full_page_scroll_by: z.coerce.number().int().default(0),
  full_page_scroll_delay: z.coerce.number().int().default(100),
  thumbnail_width: z.coerce.number().int().min(1).optional(),
  thumbnail_height: z.coerce.number().int().min(1).optional(),
  thumbnail_fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).default("inside"),
  wait_until: WaitUntilSchema,
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
