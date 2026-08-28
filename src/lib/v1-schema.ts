import { z } from "zod";
import { ScreenshotOptionsSchema, CookieSchema, type ScreenshotOptions } from "@/lib/schema";

/**
 * v1 API request schema (camelCase, developer-facing) mapped onto the
 * internal snake_case renderer options via buildRenderOptions().
 *
 * Device presets set the full emulation profile (viewport, scale, touch, UA).
 * Viewport presets set only dimensions + scale — useful for responsive testing
 * without device emulation.
 */
export const V1ScreenshotRequestSchema = z.object({
  url: z.string().url().optional(),
  html: z.string().optional(),
  markdown: z.string().optional(),
  width: z.coerce.number().int().min(1).max(5000).optional(),
  height: z.coerce.number().int().min(1).max(5000).optional(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional(),
  viewport: z.enum([
    "mobile_sm", "mobile", "mobile_lg",
    "tablet", "tablet_lg",
    "desktop", "desktop_hd",
  ]).optional(),
  device_scale_factor: z.coerce.number().int().min(1).max(3).optional(),
  // Device emulation overrides (blueprint §27)
  is_mobile: z.coerce.boolean().optional(),
  has_touch: z.coerce.boolean().optional(),
  user_agent: z.string().max(512).optional(),
  format: z.enum(["png", "jpeg", "webp", "pdf", "gif", "mp4", "webm"]).default("png"),
  quality: z.coerce.number().int().min(1).max(100).optional(),
  // Geo-targeting (Pro+): render through a residential exit in this country.
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/, {
      message: "country must be a 2-letter ISO 3166-1 alpha-2 code (e.g. US, DE, JP).",
    })
    .optional(),
  full_page: z.coerce.boolean().optional(),
  delay: z.coerce.number().int().min(0).optional(),
  wait_for: z.enum(["load", "domcontentloaded", "networkidle0", "networkidle2"]).optional(),
  readiness: z.enum(["fast", "balanced", "complete", "custom"]).optional(),
  wait_for_selector: z.string().optional(),
  wait_for_condition: z.string().max(2000).optional(),
  selector: z.string().optional(),
  dark_mode: z.coerce.boolean().optional(),
  block_ads: z.coerce.boolean().optional(),
  block_cookie_banners: z.coerce.boolean().optional(),
  block_trackers: z.coerce.boolean().optional(),
  block_images: z.coerce.boolean().optional(),
  timeout: z.coerce.number().int().min(1000).optional(),
  // Thumbnail / resize transform (applied via the sharp pipeline after capture).
  thumbnail_width: z.coerce.number().int().min(1).max(5000).optional(),
  thumbnail_height: z.coerce.number().int().min(1).max(5000).optional(),
  thumbnail_fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).optional(),
  // Authenticated pages: seed cookies, custom HTTP headers, basic auth.
  // `cookies`/`headers` also accept a JSON-encoded string of the same shape.
  cookies: z.union([z.array(CookieSchema).max(25), z.string()]).optional(),
  headers: z.union([z.record(z.string(), z.string()), z.string()]).optional(),
  auth_username: z.string().max(256).optional(),
  auth_password: z.string().max(1024).optional(),
  // Video capture (Scale plan): record for N seconds, encode via CDP + ffmpeg.
  video_seconds: z.coerce.number().int().min(1).max(30).optional(),
  video_fps: z.coerce.number().int().min(1).max(30).optional(),
  video_speed: z.coerce.number().int().min(1).max(4).optional(),
});

export type V1ScreenshotRequest = z.infer<typeof V1ScreenshotRequestSchema>;

interface DevicePreset {
  width: number;
  height: number;
  scale: number;
  isMobile: boolean;
  hasTouch: boolean;
  userAgent?: string;
}

interface ViewportPreset {
  width: number;
  height: number;
  scale: number;
}

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const TABLET_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Full device emulation presets — viewport + scale + touch + user agent. */
const DEVICE_PRESETS: Record<string, DevicePreset> = {
  mobile:  { width: 390,  height: 844,  scale: 3, isMobile: true,  hasTouch: true,  userAgent: MOBILE_UA },
  tablet:  { width: 768,  height: 1024, scale: 2, isMobile: true,  hasTouch: true,  userAgent: TABLET_UA },
  desktop: { width: 1280, height: 720,  scale: 1, isMobile: false, hasTouch: false, userAgent: DESKTOP_UA },
};

/** Standard viewport sizes — dimensions + scale only, no device emulation. */
const VIEWPORT_PRESETS: Record<string, ViewportPreset> = {
  mobile_sm:  { width: 375,  height: 667,  scale: 2 },
  mobile:     { width: 390,  height: 844,  scale: 3 },
  mobile_lg:  { width: 430,  height: 932,  scale: 3 },
  tablet:     { width: 768,  height: 1024, scale: 2 },
  tablet_lg:  { width: 1024, height: 1366, scale: 2 },
  desktop:    { width: 1280, height: 720,  scale: 1 },
  desktop_hd: { width: 1920, height: 1080, scale: 1 },
};

export function buildRenderOptions(input: V1ScreenshotRequest): ScreenshotOptions {
  // Device preset wins over viewport preset if both are provided.
  const devicePreset = input.device ? DEVICE_PRESETS[input.device] : null;
  const viewportPreset = !devicePreset && input.viewport ? VIEWPORT_PRESETS[input.viewport] : null;

  const baseWidth = devicePreset?.width ?? viewportPreset?.width ?? 1280;
  const baseHeight = devicePreset?.height ?? viewportPreset?.height ?? 720;
  const baseScale = devicePreset?.scale ?? viewportPreset?.scale ?? 1;

  return ScreenshotOptionsSchema.parse({
    url: input.url,
    html: input.html,
    markdown: input.markdown,
    format: input.format,
    quality: input.quality ?? 80,
    viewport_width: input.width ?? baseWidth,
    viewport_height: input.height ?? baseHeight,
    device_scale_factor: input.device_scale_factor ?? baseScale,
    full_page: input.full_page ?? false,
    delay: input.delay ?? 0,
    wait_until: input.wait_for,
    readiness: input.readiness,
    wait_for_selector: input.wait_for_selector,
    wait_for_condition: input.wait_for_condition,
    selector: input.selector,
    dark_mode: input.dark_mode ?? false,
    user_agent: input.user_agent ?? devicePreset?.userAgent,
    is_mobile: input.is_mobile ?? devicePreset?.isMobile ?? false,
    has_touch: input.has_touch ?? devicePreset?.hasTouch ?? false,
    block_ads: input.block_ads ?? true,
    block_cookie_banners: input.block_cookie_banners ?? true,
    block_trackers: input.block_trackers ?? true,
    block_images: input.block_images ?? false,
    country: input.country,
    timeout: input.timeout ?? 10000,
    thumbnail_width: input.thumbnail_width,
    thumbnail_height: input.thumbnail_height,
    thumbnail_fit: input.thumbnail_fit,
    cookies: input.cookies,
    headers: input.headers,
    auth_username: input.auth_username,
    auth_password: input.auth_password,
    video_seconds: input.video_seconds,
    video_fps: input.video_fps,
    video_speed: input.video_speed,
  });
}
