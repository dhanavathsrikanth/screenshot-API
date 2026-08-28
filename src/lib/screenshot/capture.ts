import { Page, type ScreenshotOptions as PuppeteerScreenshotOptions } from "puppeteer";
import type { FormatEnum } from "sharp";
import { marked } from "marked";
import type { ScreenshotOptions } from "@/lib/schema";
import type { RenderResult } from "@/lib/screenshot/types";
import { RENDER_LIMITS } from "@/lib/security/limits";
import { captureVideo } from "@/lib/screenshot/video";

/**
 * Capture + artifact conversion (blueprint §6–§7, §26).
 *
 * Screenshots are always captured as PNG first when a Sharp conversion is
 * required (webp/gif/tiff/avif/svg), then converted and resized. PDF and HTML
 * are handled directly by the browser. Full-page and element captures are
 * both supported.
 */

const NEEDS_SHARP = new Set(["webp", "gif", "tiff", "avif", "svg"]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function applyThumbnail(
  buffer: Buffer,
  options: ScreenshotOptions
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (!options.thumbnail_width) return { buffer, width: 0, height: 0 };
  const sharp = (await import("sharp")).default;
  const resized = await sharp(buffer)
    .resize(options.thumbnail_width, options.thumbnail_height ?? undefined, {
      fit: options.thumbnail_fit,
    })
    .toBuffer();
  const resizedMeta = await sharp(resized).metadata();
  return {
    buffer: resized,
    width: resizedMeta.width ?? 0,
    height: resizedMeta.height ?? 0,
  };
}

async function convertWithSharp(
  buffer: Buffer,
  format: string,
  options: ScreenshotOptions
): Promise<RenderResult> {
  const sharp = (await import("sharp")).default;
  let pipeline = sharp(buffer);
  if (options.thumbnail_width) {
    pipeline = pipeline.resize(options.thumbnail_width, options.thumbnail_height ?? undefined, {
      fit: options.thumbnail_fit,
    });
  }
  const metadata = await sharp(buffer).metadata();
  try {
    const converted = await pipeline
      .toFormat(format as keyof FormatEnum, { quality: options.quality })
      .toBuffer();
    return {
      buffer: converted,
      format,
      width: metadata.width ?? options.viewport_width,
      height: metadata.height ?? options.viewport_height,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Format "${format}" not supported by the image processor. Supported: png, jpeg, webp, pdf, gif, tiff, avif, svg. Original error: ${msg}`
    );
  }
}

/**
 * Produce the final artifact buffer for the current page state.
 * `page` must already be fully prepared (navigation + readiness applied).
 */
export async function capturePage(
  page: Page,
  options: ScreenshotOptions
): Promise<RenderResult> {
  // ── Video / animated GIF ──────────────────────────────────────────────
  const isVideoFormat = options.format === "mp4" || options.format === "webm";
  const isAnimatedGif = options.format === "gif" && options.video_seconds && options.video_seconds > 0;
  if (isVideoFormat || isAnimatedGif) {
    return captureVideo(page, options);
  }

  // ── PDF ─────────────────────────────────────────────────────────────
  if (options.format === "pdf") {
    const pdfOptions: Record<string, unknown> = {
      format: options.pdf_format ?? "a4",
      printBackground: options.pdf_print_background ?? true,
    };
    if (options.pdf_margin_top) pdfOptions.marginTop = options.pdf_margin_top;
    if (options.pdf_margin_right) pdfOptions.marginRight = options.pdf_margin_right;
    if (options.pdf_margin_bottom) pdfOptions.marginBottom = options.pdf_margin_bottom;
    if (options.pdf_margin_left) pdfOptions.marginLeft = options.pdf_margin_left;
    const pdfBuffer = await page.pdf(pdfOptions);
    const pdfMeta = await (await import("sharp")).default(Buffer.from(pdfBuffer)).metadata().catch(() => null);
    return {
      buffer: Buffer.from(pdfBuffer),
      format: "pdf",
      width: pdfMeta?.width ?? 0,
      height: pdfMeta?.height ?? 0,
    };
  }

  // ── HTML ────────────────────────────────────────────────────────────
  if (options.format === "html") {
    const html = await page.content();
    return {
      buffer: Buffer.from(html, "utf-8"),
      format: "html",
      width: options.viewport_width,
      height: options.viewport_height,
    };
  }

  // ── Raster formats ──────────────────────────────────────────────────
  const needsSharp = NEEDS_SHARP.has(options.format);
  const captureFormat = needsSharp ? "png" : options.format;
  const type = (captureFormat === "webp" ? "png" : captureFormat) as "png" | "jpeg";

  let screenshotBuffer: Buffer;
  if (options.selector) {
    const el = await page.$(options.selector);
    if (!el) throw new Error(`Selector not found: ${options.selector}`);
    screenshotBuffer = Buffer.from(
      await el.screenshot({ type, omitBackground: options.omit_background })
    );
  } else {
    const opt: PuppeteerScreenshotOptions = {
      type,
      fullPage: options.full_page,
      captureBeyondViewport: options.capture_beyond_viewport,
      fromSurface: options.from_surface,
      omitBackground: options.omit_background,
    };
    if (type === "jpeg") opt.quality = options.quality;
    screenshotBuffer = Buffer.from(await page.screenshot(opt));
  }

  // Clamp captured dimensions to the engine ceiling.
  if (options.full_page) {
    const sharp = (await import("sharp")).default;
    const { width, height } = await sharp(screenshotBuffer).metadata();
    if ((width ?? 0) > RENDER_LIMITS.maxScreenshotWidth || (height ?? 0) > RENDER_LIMITS.maxScreenshotHeight) {
      screenshotBuffer = Buffer.from(
        await sharp(screenshotBuffer)
          .resize({
            width: Math.min(width ?? RENDER_LIMITS.maxScreenshotWidth, RENDER_LIMITS.maxScreenshotWidth),
            height: Math.min(height ?? RENDER_LIMITS.maxScreenshotHeight, RENDER_LIMITS.maxScreenshotHeight),
            fit: "inside",
          })
          .toBuffer()
      );
    }
  }

  if (options.format === "webp") {
    const result = await convertWithSharp(screenshotBuffer, "webp", options);
    result.buffer = Buffer.from(result.buffer);
    return result;
  }

  if (options.format === "svg") {
    const base64 = screenshotBuffer.toString("base64");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${options.viewport_width}" height="${options.viewport_height}"><image width="100%" height="100%" href="data:image/png;base64,${base64}"/></svg>`;
    return {
      buffer: Buffer.from(svg),
      format: "svg",
      width: options.viewport_width,
      height: options.viewport_height,
    };
  }

  if (NEEDS_SHARP.has(options.format)) {
    return convertWithSharp(screenshotBuffer, options.format, options);
  }

  // png / jpeg (optional thumbnail resize)
  if (options.thumbnail_width) {
    const { buffer, width, height } = await applyThumbnail(screenshotBuffer, options);
    return {
      buffer,
      format: options.format,
      width: width || options.viewport_width,
      height: height || options.viewport_height,
    };
  }

  return {
    buffer: screenshotBuffer,
    format: options.format,
    width: options.viewport_width,
    height: options.viewport_height,
  };
}

/** Convert markdown to styled HTML using the marked library. */
export function markdownToHtml(markdown: string): string {
  const body = marked.parse(markdown) as string;
  return `<html><head><style>
    .markdown-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; color: #24292e; }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 { margin-top: 1.5em; margin-bottom: 0.5em; font-weight: 600; }
    .markdown-body h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    .markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    .markdown-body p { margin: 1em 0; }
    .markdown-body code { background: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-size: 85%; }
    .markdown-body pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow-x: auto; }
    .markdown-body pre code { background: none; padding: 0; font-size: 100%; }
    .markdown-body blockquote { border-left: 4px solid #dfe2e5; margin: 1em 0; padding: 0 1em; color: #6a737d; }
    .markdown-body ul, .markdown-body ol { padding-left: 2em; }
    .markdown-body li { margin: 0.25em 0; }
    .markdown-body a { color: #0366d6; text-decoration: none; }
    .markdown-body table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    .markdown-body th, .markdown-body td { border: 1px solid #dfe2e5; padding: 6px 13px; }
    .markdown-body th { background: #f6f8fa; font-weight: 600; }
    .markdown-body img { max-width: 100%; }
    .markdown-body hr { border: none; border-top: 2px solid #eaecef; margin: 2em 0; }
  </style></head><body><article class="markdown-body">${body}</article></body></html>`;
}
