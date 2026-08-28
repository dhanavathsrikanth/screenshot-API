import { Browser, BrowserContext, Page } from "puppeteer";
import type { ScreenshotOptions } from "@/lib/schema";
import { clampViewport } from "@/lib/security/limits";

/**
 * Per-request browser session management (blueprint §28–§29).
 *
 * Every render gets its own ephemeral incognito context so cookies,
 * localStorage and service workers can never leak between customers:
 *
 *   Browser
 *   ├── Context A → customer A
 *   ├── Context B → customer B
 *   └── Context C → customer C
 *
 * The context is closed (destroyed) when the render finishes.
 */

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const TABLET_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export interface RenderSession {
  context: BrowserContext;
  page: Page;
}

/** Resolve the effective user agent for the request. */
export function resolveUserAgent(options: ScreenshotOptions): string {
  if (options.user_agent) return options.user_agent;
  if (options.is_mobile && options.has_touch) return MOBILE_UA;
  if (options.device_scale_factor >= 2 && options.is_mobile) return TABLET_UA;
  return DEFAULT_UA;
}

/**
 * Create an isolated context + page for one render. Applies viewport
 * (with engine-level dimension caps), device emulation flags, user agent,
 * and media emulation (dark mode / reduced motion).
 */
export async function createRenderSession(b: Browser, options: ScreenshotOptions): Promise<RenderSession> {
  const context = await b.createBrowserContext();
  let page: Page;
  try {
    page = await context.newPage();

    const viewport = clampViewport(options.viewport_width, options.viewport_height);

    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: options.device_scale_factor,
      isMobile: options.is_mobile,
      hasTouch: options.has_touch,
    });

    await page.setUserAgent(resolveUserAgent(options));

    if (options.dark_mode) {
      await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
    }
    if (options.reduced_motion) {
      await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    }
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }
  return { context, page };
}
