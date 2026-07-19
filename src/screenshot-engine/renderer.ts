import puppeteer, { Browser, Page } from "puppeteer";
import type { ScreenshotOptions } from "@/lib/schema";
import { sleep } from "@/lib/utils";

let browser: Browser | null = null;
let activeTabs = 0;
const MAX_PAGES = 5;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROME_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--disable-gpu",
        "--disable-extensions",
        "--disable-background-networking",
      ],
    });
  }
  return browser;
}

export async function shutdownBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export interface RenderResult {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
}

export async function render(options: ScreenshotOptions): Promise<RenderResult> {
  const b = await getBrowser();

  while (activeTabs >= MAX_PAGES) {
    await sleep(100);
  }
  activeTabs++;

  let page: Page | null = null;

  try {
    page = await b.newPage();

    await page.setUserAgent(USER_AGENT);

    if (options.proxy) {
      const useProxy = (await import("puppeteer-page-proxy")).default;
      useProxy(page, options.proxy);
    }

    // Proxy per request (with optional resource type skipping)
    if (options.proxy_per_request) {
      await page.setRequestInterception(true);
      const useProxy = (await import("puppeteer-page-proxy")).default;
      const proxyUrl = options.proxy_per_request;
      page.on("request", async (request) => {
        const resourceType = request.resourceType();
        const shouldSkip =
          (options.proxy_skip_images && resourceType === "image") ||
          (options.proxy_skip_fonts && resourceType === "font") ||
          (options.proxy_skip_media && resourceType === "media") ||
          (options.proxy_skip_stylesheets && resourceType === "stylesheet");
        if (shouldSkip) {
          request.continue();
        } else {
          await useProxy(request, proxyUrl);
        }
      });
    }

    await page.setViewport({
      width: options.viewport_width,
      height: options.viewport_height,
      deviceScaleFactor: options.device_scale_factor,
    });

    if (options.dark_mode) {
      await page.emulateMediaFeatures([
        { name: "prefers-color-scheme", value: "dark" },
      ]);
    }

    if (options.reduced_motion) {
      await page.emulateMediaFeatures([
        { name: "prefers-reduced-motion", value: "reduce" },
      ]);
    }

    if (options.block_ads || options.block_cookie_banners || options.block_trackers) {
      const { PuppeteerBlocker } = await import("@cliqz/adblocker-puppeteer");
      const fetch = (await import("cross-fetch")).default;
      const lists: string[] = [];
      if (options.block_cookie_banners) {
        lists.push("https://secure.fanboy.co.nz/fanboy-cookiemonster.txt");
      }
      if (options.block_ads || options.block_trackers) {
        lists.push("https://easylist.to/easylist/easylist.txt");
      }
      if (lists.length > 0) {
        const blocker = await PuppeteerBlocker.fromLists(fetch, lists);
        await blocker.enableBlockingInPage(page);
      }
    }

    // Resource type blocking (images, fonts, media, etc.)
    const resourceTypesToBlock: string[] = [];
    if (options.block_images) resourceTypesToBlock.push("image");
    if (options.block_fonts) resourceTypesToBlock.push("font");
    if (options.block_media) resourceTypesToBlock.push("media");
    if (options.block_stylesheets) resourceTypesToBlock.push("stylesheet");
    if (options.block_scripts) resourceTypesToBlock.push("script");
    if (options.block_xhr) resourceTypesToBlock.push("xhr");
    if (options.block_fetch) resourceTypesToBlock.push("fetch");
    if (options.block_websocket) resourceTypesToBlock.push("websocket");
    if (options.block_manifest) resourceTypesToBlock.push("manifest");
    if (options.block_other) resourceTypesToBlock.push("other");

    // Parse custom domains to block
    const customDomains = options.block_domains
      ? options.block_domains.split(",").map((d) => d.trim()).filter(Boolean)
      : [];
    // Parse custom URL patterns to block
    const customPatterns = options.block_url_patterns
      ? options.block_url_patterns.split(",").map((p) => p.trim()).filter(Boolean)
      : [];

    if (
      resourceTypesToBlock.length > 0 ||
      customDomains.length > 0 ||
      customPatterns.length > 0
    ) {
      await page.setRequestInterception(true);
      page.on("request", (request) => {
        const url = request.url();
        const resourceType = request.resourceType();

        // Block by resource type
        if (resourceTypesToBlock.includes(resourceType)) {
          return request.abort();
        }

        // Block by custom domain
        if (customDomains.length > 0) {
          try {
            const hostname = new URL(url).hostname;
            if (customDomains.some((d) => hostname === d || hostname.endsWith("." + d))) {
              return request.abort();
            }
          } catch {
            // Invalid URL, skip domain check
          }
        }

        // Block by custom URL pattern (simple substring match)
        if (customPatterns.length > 0) {
          if (customPatterns.some((p) => url.includes(p))) {
            return request.abort();
          }
        }

        request.continue();
      });
    }

    if (options.html) {
      const waitUntil = (options.wait_until === "networkidle0" || options.wait_until === "networkidle2")
        ? "load"
        : options.wait_until ?? "load";
      await page.setContent(options.html, {
        waitUntil,
        timeout: options.timeout,
      });
    } else if (options.markdown) {
      const html = `<html><body><article class="markdown-body">${escapeHtml(options.markdown)}</article></body></html>`;
      const waitUntil = (options.wait_until === "networkidle0" || options.wait_until === "networkidle2")
        ? "load"
        : options.wait_until ?? "load";
      await page.setContent(html, {
        waitUntil,
        timeout: options.timeout,
      });
    } else if (options.url) {
      let response;
      try {
        response = await page.goto(options.url, {
          waitUntil: ["domcontentloaded", "networkidle2"],
          timeout: options.timeout,
        });
        // Handle case where page.goto() returns null (can happen with redirects)
        if (!response) {
          response = await page.waitForResponse(() => true, { timeout: options.timeout });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("Connection closed") ||
          msg.includes("net::ERR_CONNECTION_CLOSED") ||
          msg.includes("Protocol error") ||
          msg.includes("Target closed")
        ) {
          throw new Error(
            `Failed to load ${options.url}: the site blocks automated browsers. Try a different URL or use the API with a custom User-Agent.`
          );
        }
        throw err;
      }
      if (response && response.status() >= 400) {
        throw new Error(`Page returned HTTP ${response.status()}`);
      }
    } else {
      throw new Error("Must provide url, html, or markdown");
    }

    if (options.block_chats) {
      const chatSelectors = [
        ".crisp-client", "#intercom-container", ".tawk-min-container",
        ".drift-widget", ".fb_dialog", "#hubspot-messages-iframe-container",
        ".zopim", ".livechat-widget", "#tidio-chat",
      ];
      await page.evaluate((selectors: string[]) => {
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach((el) => {
            (el as HTMLElement).style.display = "none";
          });
        }
      }, chatSelectors);
    }

    if (options.hide_selectors) {
      const selectors = options.hide_selectors.split(",");
      await page.evaluate((sels: string[]) => {
        for (const sel of sels) {
          document.querySelectorAll(sel.trim()).forEach((el) => {
            (el as HTMLElement).style.display = "none";
          });
        }
      }, selectors);
    }

    if (options.style_url) {
      await page.addStyleTag({ url: options.style_url });
    }
    if (options.style_path) {
      await page.addStyleTag({ path: options.style_path });
    }
    if (options.styles) {
      await page.addStyleTag({ content: options.styles });
    }

    if (options.script_url) {
      await page.addScriptTag({ url: options.script_url });
    }
    if (options.script_path) {
      await page.addScriptTag({ path: options.script_path });
    }
    if (options.scripts) {
      await page.addScriptTag({ content: options.scripts });
    }

    if (options.click) {
      await page.waitForSelector(options.click, { visible: true, timeout: 10000 }).catch(() => {});
      await page.click(options.click).catch(() => {});
    }

    if (options.full_page && options.full_page_scroll_by > 0) {
      await page.evaluate(async (scrollBy: number) => {
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
        let totalScroll = 0;
        const scrollHeight = document.scrollingElement?.scrollHeight ?? 0;
        while (totalScroll < scrollHeight) {
          window.scrollBy(0, scrollBy);
          totalScroll += scrollBy;
          await delay(100);
        }
        window.scrollTo(0, 0);
      }, options.full_page_scroll_by);
      // Wait for lazy-loaded images to finish loading after scroll
      await page.waitForFunction(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.every((img) => img.complete);
      }).catch(() => {});
    } else if (options.full_page) {
      const scrollDelay = options.full_page_scroll_delay || 100;
      await page.evaluate(async (delay: number) => {
        await new Promise<void>((resolve) => {
          let i = setInterval(() => {
            window.scrollBy(0, window.innerHeight);
            if (
              document.scrollingElement &&
              document.scrollingElement.scrollTop + window.innerHeight >=
                document.scrollingElement.scrollHeight
            ) {
              window.scrollTo(0, 0);
              clearInterval(i);
              resolve();
            }
          }, delay);
        });
      }, scrollDelay);
      // Wait for lazy-loaded images to finish loading after scroll
      await page.waitForFunction(() => {
        const images = Array.from(document.querySelectorAll('img'));
        return images.every((img) => img.complete);
      }).catch(() => {});
    }

    if (options.delay > 0) {
      await sleep(options.delay);
    }

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
      return {
        buffer: Buffer.from(pdfBuffer),
        format: "pdf",
        width: 0,
        height: 0,
      };
    }

    if (options.format === "html") {
      const html = await page.content();
      return {
        buffer: Buffer.from(html, "utf-8"),
        format: "html",
        width: options.viewport_width,
        height: options.viewport_height,
      };
    }

    let screenshotBuffer: Buffer;

    const needsSharpConversion = ["webp", "gif", "tiff", "avif", "svg"].includes(options.format);

    // For formats needing Sharp, always capture as PNG first
    const captureFormat = needsSharpConversion ? "png" : options.format;

    if (options.selector) {
      const el = await page.$(options.selector);
      if (!el) throw new Error(`Selector not found: ${options.selector}`);
      const elBuffer = await el.screenshot({
        type: captureFormat === "webp" ? "png" : (captureFormat as "png" | "jpeg"),
        omitBackground: options.omit_background,
      });
      screenshotBuffer = Buffer.from(elBuffer);
    } else {
      const opt: Record<string, unknown> = {
        type: captureFormat === "webp" ? "png" : (captureFormat as "png" | "jpeg"),
        fullPage: options.full_page,
        captureBeyondViewport: options.capture_beyond_viewport,
        fromSurface: options.from_surface,
        omitBackground: options.omit_background,
      };
      if (captureFormat === "jpeg") {
        opt.quality = options.quality;
      }
      const raw = await page.screenshot(opt as any);
      screenshotBuffer = Buffer.from(raw);
    }

    if (options.format === "webp") {
      const sharp = (await import("sharp")).default;
      let pipeline = sharp(screenshotBuffer);
      if (options.thumbnail_width) {
        pipeline = pipeline.resize(options.thumbnail_width, options.thumbnail_height ?? undefined, {
          fit: options.thumbnail_fit as any,
        });
      }
      const metadata = await sharp(screenshotBuffer).metadata();
      screenshotBuffer = await pipeline.webp({ quality: options.quality }).toBuffer();
      return {
        buffer: screenshotBuffer,
        format: "webp",
        width: metadata.width ?? options.viewport_width,
        height: metadata.height ?? options.viewport_height,
      };
    }

    // SVG: wrap PNG in SVG container (Sharp doesn't support SVG output)
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

    if (options.format !== "png" && options.format !== "jpeg") {
      const sharp = (await import("sharp")).default;
      let pipeline = sharp(screenshotBuffer);
      if (options.thumbnail_width) {
        pipeline = pipeline.resize(options.thumbnail_width, options.thumbnail_height ?? undefined, {
          fit: options.thumbnail_fit as any,
        });
      }
      const metadata = await sharp(screenshotBuffer).metadata();
      try {
        const formatOptions: Record<string, any> = { quality: options.quality };
        screenshotBuffer = await pipeline.toFormat(options.format as any, formatOptions).toBuffer();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(
          `Format "${options.format}" not supported by the image processor. Supported: png, jpeg, webp, pdf, gif, tiff, avif, svg. Original error: ${msg}`
        );
      }
      return {
        buffer: screenshotBuffer,
        format: options.format,
        width: metadata.width ?? options.viewport_width,
        height: metadata.height ?? options.viewport_height,
      };
    }

    if (options.thumbnail_width) {
      const sharp = (await import("sharp")).default;
      const metadata = await sharp(screenshotBuffer).metadata();
      screenshotBuffer = await sharp(screenshotBuffer)
        .resize(options.thumbnail_width, options.thumbnail_height ?? undefined, {
          fit: options.thumbnail_fit as any,
        })
        .toBuffer();
      return {
        buffer: screenshotBuffer,
        format: options.format,
        width: metadata.width ?? options.viewport_width,
        height: metadata.height ?? options.viewport_height,
      };
    }

    return {
      buffer: screenshotBuffer,
      format: options.format,
      width: options.viewport_width,
      height: options.viewport_height,
    };
  } finally {
    if (page) await page.close().catch(() => {});
    activeTabs--;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
