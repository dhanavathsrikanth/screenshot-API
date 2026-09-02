import { Browser, Page, TimeoutError, type CookieParam } from "puppeteer";
import type { ScreenshotOptions } from "@/lib/schema";
import { RenderError, type RenderResult } from "@/lib/screenshot/types";
import { capturePage, markdownToHtml } from "@/lib/screenshot/capture";
import {
  applyReadiness,
  resolveWaitUntil,
  resolveSetContentWaitUntil,
} from "@/lib/screenshot/readiness";
import { enableBlocking } from "@/lib/screenshot/blocker";
import { overlaySelectorsFor } from "@/lib/screenshot/clean-presets";
import { dismissOverlaysWithSnapshot } from "@/lib/screenshot/agent-clean";
import { withBrowserRetry } from "@/lib/browser/manager";
import { createRenderSession } from "@/lib/browser/context";
import { buildGeoProxyUrl, GeoTargetingError } from "@/lib/browser/geo";
import {
  validateRedirectUrl,
  validateTargetUrl,
  SsrfError,
} from "@/lib/security/ssrf";
import { RENDER_LIMITS, withTotalBudget } from "@/lib/security/limits";
import { logger } from "@/lib/logger";

// Suppress url.parse() deprecation warning from transitive deps
// (http-proxy-agent@5, https-proxy-agent@5)
process.removeAllListeners("warning");
process.on("warning", (warn) => {
  if (warn.name === "DeprecationWarning" && warn.message.includes("url.parse()")) return;
  process.emitWarning(warn);
});

let activeRenders = 0;

async function acquireSlot(): Promise<void> {
  while (activeRenders >= RENDER_LIMITS.maxConcurrentPages) {
    await new Promise((r) => setTimeout(r, 25));
  }
  activeRenders++;
}

function releaseSlot(): void {
  activeRenders = Math.max(0, activeRenders - 1);
}

async function assertSafeUrl(url: string): Promise<void> {
  try {
    await validateTargetUrl(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      throw new RenderError(err.code, err.message);
    }
    throw err;
  }
}

function isBotBlockedError(msg: string): boolean {
  return (
    msg.includes("Connection closed") ||
    msg.includes("net::ERR_CONNECTION_CLOSED") ||
    msg.includes("Protocol error") ||
    msg.includes("Target closed")
  );
}

function isPrivateHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  );
}

/**
 * Public render entry point. Wraps the pipeline in a hard total-time budget
 * and the browser in crash-recovery retry (exactly once).
 */
export async function render(options: ScreenshotOptions): Promise<RenderResult> {
  const isVideo = options.format === "mp4" || options.format === "webm" ||
    (options.format === "gif" && options.video_seconds && options.video_seconds > 0);
  const budgetMs = isVideo ? 120_000 : RENDER_LIMITS.maxTotalTimeMs;
  return withTotalBudget(
    withBrowserRetry((b) => renderOnce(b, options)),
    budgetMs
  );
}

/** Run one render in a fresh isolated browser context. */
async function renderOnce(b: Browser, options: ScreenshotOptions): Promise<RenderResult> {
  await acquireSlot();
  try {
    const session = await createRenderSession(b, options);
    const { context, page } = session;
    try {
      await preparePage(page, options);
      return await capturePage(page, options);
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    releaseSlot();
  }
}

/** All per-request page setup: proxy, blocking, navigation, readiness. */
async function preparePage(page: Page, options: ScreenshotOptions): Promise<void> {
  // Auto-fix for CSR/Next.js like pw.live: don't block trackers/scripts that hydrate 404 skeleton
  const isPwLive = options.url?.includes("pw.live") || !!options.url?.includes("physicswallah");
  if (isPwLive) {
    if (!options.wait_for_text && !options.wait_for_selector) options.wait_for_text = "TGPSC";
    if (!options.wait_until) options.wait_until = "networkidle2" as never;
    options.readiness = "custom" as never;
    if (options.block_trackers) options.block_trackers = false;
    if (options.block_ads) options.block_ads = false;
    if (options.delay < 800) options.delay = 800;
  }
  // ── Robust device + geo — agent-browser set device / set geo ──────────
  try {
    const { applyRobustDeviceGeo } = await import("@/lib/screenshot/agent-device-geo");
    await applyRobustDeviceGeo(page, {
      is_mobile: options.is_mobile,
      has_touch: options.has_touch,
      viewport_width: options.viewport_width,
      viewport_height: options.viewport_height,
      device_scale_factor: options.device_scale_factor,
      user_agent: options.user_agent,
      country: options.country,
    });
  } catch {}
  // ── Proxy ───────────────────────────────────────────────────────────
  // Precedence: explicit proxy > geo-targeted country proxy. The geo URL is
  // resolved here (worker-side, once per render attempt) so the result-cache
  // key only ever contains the stable `country` code, and so browser-crash
  // retries get a fresh sticky session / exit IP.
  let pageProxy = options.proxy;
  if (!pageProxy && !options.proxy_per_request && options.country) {
    try {
      pageProxy = await buildGeoProxyUrl(options.country);
    } catch (err) {
      if (err instanceof GeoTargetingError) {
        const code =
          err.code === "INVALID_COUNTRY"
            ? "INVALID_COUNTRY"
            : err.code === "UNSUPPORTED_COUNTRY"
              ? "UNSUPPORTED_COUNTRY"
              : "GEO_UNAVAILABLE";
        throw new RenderError(code, err.message);
      }
      throw err;
    }
  }

  if (pageProxy && !options.proxy_per_request) {
    const applyProxy = (await import("puppeteer-page-proxy")).default;
    await applyProxy(page, pageProxy);
  }

  // ── Request interception (blocking + per-request proxy) ─────────────
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

  const customDomains = options.block_domains
    ? options.block_domains.split(",").map((d) => d.trim()).filter(Boolean)
    : [];
  const customPatterns = options.block_url_patterns
    ? options.block_url_patterns.split(",").map((p) => p.trim()).filter(Boolean)
    : [];

  const proxyPerRequest = options.proxy_per_request;
  const needsInterception =
    proxyPerRequest !== undefined ||
    resourceTypesToBlock.length > 0 ||
    customDomains.length > 0 ||
    customPatterns.length > 0;

  if (needsInterception) {
    const applyProxy = (await import("puppeteer-page-proxy")).default;
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
      const url = request.url();
      const resourceType = request.resourceType();

      if (resourceTypesToBlock.includes(resourceType)) {
        return request.abort();
      }

      if (customDomains.length > 0) {
        try {
          const hostname = new URL(url).hostname;
          if (customDomains.some((d) => hostname === d || hostname.endsWith("." + d))) {
            return request.abort();
          }
        } catch {
          // invalid URL — skip domain check
        }
      }

      if (customPatterns.length > 0 && customPatterns.some((p) => url.includes(p))) {
        return request.abort();
      }

      if (proxyPerRequest) {
        const shouldSkip =
          (options.proxy_skip_images && resourceType === "image") ||
          (options.proxy_skip_fonts && resourceType === "font") ||
          (options.proxy_skip_media && resourceType === "media") ||
          (options.proxy_skip_stylesheets && resourceType === "stylesheet");
        if (shouldSkip) return request.continue();
        return applyProxy(request, proxyPerRequest);
      }

      request.continue();
    });
  }

  // ── Ad / tracker / cookie-banner blocking ───────────────────────────
  if (options.block_ads || options.block_cookie_banners || options.block_trackers) {
    await enableBlocking(page);
  }

  // ── Auth surface: agent-browser form login + HTTP basic auth, custom headers, cookies ──
  // Agent-browser style: if login_url is set, do form login first (auth save/login), else basic auth
  if (options.login_url && options.auth_username && options.auth_password) {
    const { tryAgentFormLogin } = await import("@/lib/screenshot/agent-auth");
    await tryAgentFormLogin(page, {
      login_url: options.login_url,
      username_selector: options.username_selector,
      password_selector: options.password_selector,
      submit_selector: options.submit_selector,
      auth_username: options.auth_username,
      auth_password: options.auth_password,
    });
  } else if (options.auth_username !== undefined || options.auth_password !== undefined) {
    await page.authenticate({
      username: options.auth_username ?? "",
      password: options.auth_password ?? "",
    });
  }
  if (options.headers && Object.keys(options.headers).length > 0) {
    await page.setExtraHTTPHeaders(options.headers);
  }
  // Cookies only apply to URL navigations — html/markdown never leave the page.
  // Domain defaults to the target hostname; secure defaults to https targets.
  if (options.cookies?.length && options.url) {
    const target = new URL(options.url);
    const cookieParams: CookieParam[] = options.cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain ?? target.hostname,
      path: c.path ?? "/",
      secure: c.secure ?? target.protocol === "https:",
      ...(c.expires !== undefined ? { expires: c.expires } : {}),
      ...(c.http_only !== undefined ? { httpOnly: c.http_only } : {}),
      ...(c.same_site ? { sameSite: c.same_site } : {}),
    }));
    await page.setCookie(...cookieParams);
  }

  // ── Load content ────────────────────────────────────────────────────
  if (options.html) {
    await page.setContent(options.html, {
      waitUntil: resolveSetContentWaitUntil(options),
      timeout: Math.min(options.timeout, 15_000),
    });
  } else if (options.markdown) {
    await page.setContent(markdownToHtml(options.markdown), {
      waitUntil: resolveSetContentWaitUntil(options),
      timeout: Math.min(options.timeout, 15_000),
    });
  } else if (options.url) {
    await navigate(page, options);
    // Auto-recover 404 skeleton on CSR sites like pw.live — wait for real content
    if (options.url.includes("pw.live")) {
      const is404 = await page.evaluate(() => document.body.innerText.slice(0,2000).toLowerCase().includes("404") && !document.body.innerText.includes("TGPSC")).catch(() => false);
      if (is404) {
        await page.waitForFunction(() => document.body.innerText.includes("TGPSC"), { timeout: 8000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 600));
      }
    }
  } else {
    throw new Error("Must provide url, html, or markdown");
  }

  // ── Post-navigation DOM mutations (consent / chat / hide_selectors) ─
  // Deterministic CSS hide + agent-browser snapshot/covering check
  const overlaySelectors = overlaySelectorsFor({
    preset: options.clean_preset,
    blockCookieBanners: options.block_cookie_banners,
    blockChats: options.block_chats,
    hideSelectors: options.hide_selectors,
  });
  if (overlaySelectors.length > 0) {
    await page.evaluate((sels: string[]) => {
      for (const sel of sels) {
        try {
          document.querySelectorAll(sel).forEach((el) => {
            (el as HTMLElement).style.setProperty("display", "none", "important");
          });
        } catch {
          // Invalid selector from the caller — skip it.
        }
      }
    }, overlaySelectors);
  }
  // Agent-browser style: snapshot → find covering banner at viewport centre → click dismiss/ hide
  // Mirrors `agent-browser click @e2` fails early when covered by <div#consent-banner>
  if (options.block_cookie_banners || options.block_chats) {
    await dismissOverlaysWithSnapshot(page);
  }
  // Scroll-triggered popups/dialogs — like newsletter modals on scroll
  if (options.block_popups) {
    const { dismissScrollPopups } = await import("@/lib/screenshot/agent-popup");
    await dismissScrollPopups(page);
  }

  if (options.style_url) await page.addStyleTag({ url: options.style_url });
  if (options.style_path) await page.addStyleTag({ path: options.style_path });
  if (options.styles) await page.addStyleTag({ content: options.styles });

  if (options.script_url) await page.addScriptTag({ url: options.script_url });
  if (options.script_path) await page.addScriptTag({ path: options.script_path });
  if (options.scripts) await page.addScriptTag({ content: options.scripts });

  if (options.click) {
    await page.waitForSelector(options.click, { visible: true, timeout: 5000 }).catch(() => {});
    await page.click(options.click).catch(() => {});
  }

  // ── Full-page scrolling for lazy content — agent-browser inspired ──
  // Mirrors `agent-browser scroll down` + `snapshot` + `wait --load networkidle`
  // Ensures infinite scroll & lazy images are fully revealed before stitching.
  if (options.full_page) {
    const { ensureLazyContentLoaded } = await import("@/lib/screenshot/agent-fullpage");
    // Keep original scroll_by behavior if explicitly set, otherwise use agent fullpage
    if (options.full_page_scroll_by > 0) {
      await page.evaluate(async (scrollBy: number) => {
        const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
        let totalScroll = 0;
        const scrollHeight = document.scrollingElement?.scrollHeight ?? 0;
        while (totalScroll < scrollHeight) {
          window.scrollBy(0, scrollBy);
          totalScroll += scrollBy;
          await delay(50);
        }
        window.scrollTo(0, 0);
      }, options.full_page_scroll_by);
    } else {
      await ensureLazyContentLoaded(page);
    }
  }

  // ── Readiness (fonts / images / layout stability / custom) ──────────
  await applyReadiness(page, options);
}

/** Navigate to a URL with SSRF + redirect guards and resource limits. */
async function navigate(page: Page, options: ScreenshotOptions): Promise<void> {
  if (!options.url) throw new Error("Missing url");

  await assertSafeUrl(options.url);

  const waitUntil = resolveWaitUntil(options);
  const timeout = Math.min(options.timeout, RENDER_LIMITS.maxNavigationTimeMs);

  let response;
  try {
    response = await page.goto(options.url, { waitUntil, timeout });
    if (!response) {
      response = await page.waitForResponse(() => true, { timeout: 5000 });
    }

    // Redirect-aware SSRF: re-validate the final URL after any redirects,
    // and enforce the max-redirects limit.
    if (response) {
      const finalUrl = response.url();
      if (finalUrl && finalUrl !== options.url) {
        try {
          await validateRedirectUrl(finalUrl);
        } catch (err) {
          if (err instanceof SsrfError) {
            logger.error({ event: "redirect_ssrf_blocked", url: options.url, finalUrl, error: err.message });
            throw new RenderError("SSRF_BLOCKED", `Redirect blocked: ${err.message}`);
          }
          throw err;
        }
      }

      const redirectCount = response.request().redirectChain().length;
      if (redirectCount > RENDER_LIMITS.maxRedirects) {
        throw new RenderError(
          "TOO_MANY_REDIRECTS",
          `Page exceeded the maximum of ${RENDER_LIMITS.maxRedirects} redirects.`
        );
      }
    }
  } catch (err) {
    if (err instanceof RenderError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ event: "navigation_failed", url: options.url, error: msg });
    // Keep the literal "Navigation timeout" substring in the wrapped message —
    // bulk rendering's isRetryableError() matches on it to retry slow pages.
    if (err instanceof TimeoutError || msg.includes("Navigation timeout")) {
      throw new RenderError(
        "NAVIGATION_TIMEOUT",
        `Navigation timeout after ${timeout}ms while loading ${options.url}.`
      );
    }
    if (isBotBlockedError(msg)) {
      throw new RenderError(
        "NAVIGATION_FAILED",
        `Failed to load ${options.url}: the site blocks automated browsers. Try a different URL or use the API with a custom User-Agent.`
      );
    }
    throw new RenderError("NAVIGATION_FAILED", `Failed to load ${options.url}: ${msg}`);
  }

  if (response && response.status() >= 400) {
    throw new RenderError("NAVIGATION_FAILED", `Page returned HTTP ${response.status()}`);
  }

  // Belt-and-suspenders: reject private-hostname literals that slipped
  // through protocol-relative edge cases.
  try {
    const parsed = new URL(response?.url() ?? options.url);
    if (isPrivateHostname(parsed.hostname.toLowerCase())) {
      throw new RenderError("SSRF_BLOCKED", "Local hostnames are not allowed.");
    }
  } catch {
    // keep original error if URL parsing fails
  }
}
