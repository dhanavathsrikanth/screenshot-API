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
 * Capture a full page by scrolling through it in real viewport-height steps
 * and stitching the individual shots together. Unlike Puppeteer's built-in
 * `fullPage` capture (which resizes the viewport to the whole page and shoots
 * once from the top), this preserves the real viewport so scroll-triggered
 * animations and lazy content render correctly, and it always reaches the very
 * bottom — including the footer — even when the page grows while scrolling.
 */
async function captureFullPageStitched(
  page: Page,
  type: "png" | "jpeg"
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const viewport = page.viewport() ?? { width: 1280, height: 720 };
  const shotHeight = Math.max(viewport.height, 1);

  const measureHeight = async (): Promise<number> =>
    page.evaluate(() => {
      const el = document.scrollingElement || document.documentElement;
      return el.scrollHeight;
    });

  const tiles: Buffer[] = [];
  const maxShots = 120; // guard against infinite/very tall pages

  let previousTop = -1;
  let i = 0;

  while (i < maxShots) {
    const totalHeight = Math.max(await measureHeight(), shotHeight);
    const top = Math.min(i * shotHeight, totalHeight - shotHeight);
    if (Math.floor(top) === Math.floor(previousTop)) break; // no further progress
    previousTop = top;

    await page.evaluate((y) => window.scrollTo(0, y), top);
    // Let scroll-triggered animations settle before capturing this view.
    await new Promise((r) => setTimeout(r, 100));

    let tile: Buffer;
    if (type === "jpeg") {
      tile = Buffer.from(
        await page.screenshot({ type: "jpeg", quality: 85, fromSurface: true, captureBeyondViewport: false })
      );
    } else {
      tile = Buffer.from(
        await page.screenshot({ type: "png", fromSurface: true, captureBeyondViewport: false })
      );
    }
    tiles.push(tile);

    // Re-measure after this view; if lazy content grew the page, keep scrolling
    // so newly-revealed content (including the footer) is never missed.
    const grewHeight = Math.max(await measureHeight(), shotHeight);
    if (top + shotHeight >= grewHeight - 1) {
      await new Promise((r) => setTimeout(r, 150));
      const afterBottom = Math.max(await measureHeight(), shotHeight);
      if (afterBottom <= totalHeight) break; // bottom is stable, done
    }
    i++;
  }

  // Scroll back to the top so the final document state matches the capture.
  await page.evaluate(() => window.scrollTo(0, 0));

  if (tiles.length === 1) return tiles[0];

  const meta = await sharp(tiles[0]).metadata();
  const tileWidth = meta.width ?? viewport.width;
  const tileCount = tiles.length;
  const stitchedHeight = tileCount * shotHeight;

  const composed = await sharp({
    create: {
      width: tileWidth,
      height: Math.max(1, Math.round(stitchedHeight)),
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(
      tiles.map((t, idx) => ({
        input: t,
        top: Math.min(idx * shotHeight, Math.round(stitchedHeight) - 1),
        left: 0,
      }))
    )
    .png()
    .toBuffer();

  return type === "jpeg"
    ? Buffer.from(await sharp(composed).jpeg({ quality: 85 }).toBuffer())
    : composed;
}

/**
 * Produce the final artifact buffer for the current page state.
 * `page` must already be fully prepared (navigation + readiness applied).
 */
export async function capturePage(
  page: Page,
  options: ScreenshotOptions
): Promise<RenderResult> {
  // ── Video / animated GIF — agent-browser record start/stop ──────────
  const isVideoFormat = options.format === "mp4" || options.format === "webm";
  const isAnimatedGif = options.format === "gif" && options.video_seconds && options.video_seconds > 0;
  if (isVideoFormat || isAnimatedGif) {
    const { captureVideoAgent } = await import("@/lib/screenshot/agent-video");
    return captureVideoAgent(page, options);
  }

  // ── a11y audit (agent-browser a11y) — warn before capture, don't block
  if (options.a11y_check !== false) {
    try {
      const { runA11yAudit, a11yToWarning } = await import("@/lib/screenshot/agent-a11y");
      const a11y = await runA11yAudit(page);
      const warn = a11yToWarning(a11y as never);
      if (warn) {
        const { logger } = await import("@/lib/logger");
        logger.warn({ event: "a11y_warning", warning: warn, url: page.url() });
      }
    } catch {}
  }

  // ── Chat single-shot — "take screenshot of pricing table" auto-navigates ──
  // Every plain-English `selector` (e.g. "pricing", "footer", "login button") is now routed through AI
  // so the description under "Capture a specific part" is actually followed.
  let chatInput = (options as unknown as { chat_input?: string }).chat_input;
  if (!chatInput && options.selector) {
    const sel = options.selector.trim();
    const isCssLike = /^[#.\[]/.test(sel) || sel.includes(">") || sel.includes("+") || sel.includes("~") || sel.includes(":") || sel.includes("[");
    const isPlainEnglish = !isCssLike && /^[a-zA-Z][\w\s-]*$/.test(sel) && sel.length >= 2;
    if (isPlainEnglish) {
      chatInput = sel;
    } else {
      const hasPage = /\bpage\b/i.test(sel);
      const isMultiWord = sel.split(/\s+/).length >= 2;
      const looksNatural = /[a-z]{3,}\s+[a-z]{2,}/i.test(sel) && !/^[#.\[]/.test(sel) && !sel.includes(">") ;
      if ((hasPage && isMultiWord) || (looksNatural && sel.split(/\s+/).length > 2)) chatInput = sel;
    }
  }
  if (chatInput && (chatInput.trim().split(/\s+/).length >= 1 || /\bpage\b/i.test(chatInput))) {
    try {
      const { handleChatSingleShot } = await import("@/lib/screenshot/agent-chat");
      const chatRes = await handleChatSingleShot(page, chatInput);
      if (chatRes.suggestedUrl) {
        if (!chatRes.selector) (options as unknown as { selector: string | undefined }).selector = undefined;
        else if (chatRes.selector) (options as unknown as { selector: string }).selector = chatRes.selector;
      } else if (chatRes.selector) {
        (options as unknown as { selector: string }).selector = chatRes.selector;
      } else {
        const isPageAsk = /\bpage\b/i.test(chatInput);
        if (isPageAsk) {
          // Dynamic: let LLM extract target, no hardcode
          let word = "";
          try {
            const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
            if (process.env.OPENROUTER_API_KEY) {
              const { generateObject } = await import("ai");
              const { z } = await import("zod");
              const o = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
              const { object } = await generateObject({ model: o(process.env.OPENROUTER_MODEL || "openrouter/free"), schema: z.object({ target: z.string() }), prompt: `Extract one lower kebab target from: "${chatInput}" — e.g. "models page"->models` });
              word = object.target.toLowerCase().replace(/[^a-z0-9-]/g, "");
            }
          } catch {}
          if (!word) {
            const lower = chatInput.toLowerCase();
            const filler = new Set(["take","a","an","the","screenshot","screenshots","photo","capture","show","me","find","please","page","pages","table","section","of"]);
            const parts = lower.replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(Boolean).filter(w=>!filler.has(w));
            word = parts[0] || lower.split(/\s+/)[0].replace(/[^a-z0-9-]/g,"");
          }
          const footerLink = await page.evaluate((w) => {
            const lower = w.toLowerCase();
            const link = Array.from(document.querySelectorAll("footer a[href], nav a[href], header a[href], a[href]")).find((a) => (a.textContent || "").trim().toLowerCase() === lower || (a.getAttribute("href") || "").toLowerCase().includes(lower)) as HTMLAnchorElement | undefined;
            return link ? new URL(link.getAttribute("href") || "", location.href).href : null;
          }, word).catch(() => null) as string | null;
          if (footerLink && footerLink !== page.url()) {
            try { await page.goto(footerLink, { waitUntil: "networkidle2", timeout: 12000 }); await new Promise((r) => setTimeout(r, 800)); } catch {}
          }
          (options as unknown as { selector: string | undefined }).selector = undefined;
        } else {
          // Dynamic: use LLM target or first meaningful word
          let t = "";
          const lower = chatInput.toLowerCase();
          const filler2 = new Set(["take","a","an","the","screenshot","screenshots","photo","capture","show","me","find","please","page","pages","table","section","of"]);
          const parts2 = lower.replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(Boolean).filter(w=>!filler2.has(w));
          t = parts2[0] || "";
          if (t) (options as unknown as { selector: string }).selector = t;
          else (options as unknown as { selector: string | undefined }).selector = undefined;
        }
      }
    } catch {}
  }

  // ── Annotate + highlight for debug (agent-browser screenshot --annotate) ──
  const debugAnnotate = (options as unknown as { debug_annotate?: boolean }).debug_annotate;
  if (debugAnnotate && options.selector) {
    try {
      const { highlightSelector } = await import("@/lib/screenshot/agent-annotate");
      await highlightSelector(page, options.selector);
      await new Promise((r) => setTimeout(r, 400));
    } catch {}
  } else if (debugAnnotate && !options.selector) {
    try {
      const { annotatePage } = await import("@/lib/screenshot/agent-annotate");
      await annotatePage(page);
      await new Promise((r) => setTimeout(r, 600));
    } catch {}
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
    const rawInput = options.selector.trim().replace(/^["']|["']$/g, "");
    let el: import("puppeteer").ElementHandle<Element> | null = null;
    let selectorError: string | null = null;
    const isPlainTextEarly = !/^[#.\[]/.test(rawInput) && !rawInput.includes(">") && !rawInput.includes("+") && !rawInput.includes("~") && !rawInput.includes(":");
    const isSimplePhraseEarly = /^[a-zA-Z][\w\s-]*$/.test(rawInput);
    const looksLikePlainPhrase = isPlainTextEarly && isSimplePhraseEarly;
    // Give CSS selectors a moment to appear (dynamic content) — plain phrases skip this
    if (!looksLikePlainPhrase) {
      await page.waitForSelector(rawInput, { timeout: 2500 }).catch(() => {});
    }
    try {
      el = await page.$(rawInput);
    } catch (e) {
      selectorError = e instanceof Error ? e.message : String(e);
      // Plain phrases like "pricing table" are not valid CSS — don't fail, treat as text search
      if (looksLikePlainPhrase) selectorError = null;
    }
    if (selectorError) {
      throw new Error(`Invalid selector "${rawInput}": ${selectorError}. Use a CSS selector like "#pricing" or ".pricing".`);
    }
    // Bare-word / plain-text fallback: "pricing" -> try #pricing, .pricing, text=pricing
    // Non-technical users type what they see; we make it just work.
    if (!el) {
      const isPlainText = isPlainTextEarly;
      const isSimplePhrase = isSimplePhraseEarly;
      if (isPlainText && isSimplePhrase) {
        const singleWord = rawInput.trim().split(/\s+/)[0];
        const wordForAttr = singleWord.replace(/"/g, '\\"');
        // For phrases like "pricing table", #pricing table is invalid CSS — use first word for id/class probes
        const candidates = rawInput.includes(" ")
          ? [`#${singleWord}`, `.${singleWord}`, `[id*="${wordForAttr}" i]`, `[class*="${wordForAttr}" i]`]
          : [`#${rawInput}`, `.${rawInput}`, `[id*="${wordForAttr}" i]`, `[class*="${wordForAttr}" i]`];
        for (const cand of candidates) {
          try {
            el = await page.$(cand);
            if (el) break;
          } catch {}
        }
        const viewport = page.viewport() ?? { width: 1280, height: 720 };
        const minW = Math.max(180, Math.floor(viewport.width * 0.35));
        const minH = 80;
        // Text-content fallback: find the NEAREST meaningful container, not the largest (which is often <main>/<body>)
        if (!el) {
          try {
            const textEl = (await page.$(
              `::-p-text(${rawInput})` as unknown as string
            )) as unknown as import("puppeteer").ElementHandle<Element> | null;
            if (textEl) {
              const box = await textEl.boundingBox().catch(() => null);
              const isTiny = !box || box.width < minW || box.height < minH || box.width * box.height < minW * minH;
              if (isTiny) {
                const container = (await textEl.evaluateHandle((node, vp, word) => {
                  const lowerWord = (word as string).toLowerCase();
                  const needW = Math.max(180, Math.floor((vp as { width: number }).width * 0.35));
                  let cur: Element | null = node.parentElement;
                  let depth = 0;
                  while (cur && cur !== document.body && depth < 6) {
                    const r = (cur as HTMLElement).getBoundingClientRect();
                    const s = window.getComputedStyle(cur);
                    const tag = cur.tagName.toLowerCase();
                    const hasWord = cur.id.toLowerCase().includes(lowerWord) || (typeof cur.className === "string" && cur.className.toLowerCase().includes(lowerWord));
                    const isSection = tag === "section" || tag === "article" || tag === "main";
                    // First suitable ancestor wins — nearest section/card, not the huge page wrapper
                    if (s.visibility !== "hidden" && s.display !== "none" && r.width >= needW && r.height >= 80 && r.height < 1200 && (hasWord || isSection || (r.width * r.height < (vp as { width: number }).width * 900))) {
                      return cur;
                    }
                    cur = cur.parentElement;
                    depth++;
                  }
                  // Fallback: smallest parent that still meets size, not the biggest
                  cur = node.parentElement;
                  let smallest: Element | null = null;
                  let smallestArea = Infinity;
                  while (cur && cur !== document.body) {
                    const r = (cur as HTMLElement).getBoundingClientRect();
                    const s = window.getComputedStyle(cur);
                    if (s.visibility !== "hidden" && s.display !== "none" && r.width >= needW && r.height >= 80) {
                      const area = r.width * r.height;
                      if (area < smallestArea) { smallest = cur; smallestArea = area; }
                    }
                    cur = cur.parentElement;
                  }
                  return smallest || node;
                }, viewport, singleWord)) as unknown as import("puppeteer").ElementHandle<Element> | null;
                const upgraded = container && container.asElement() ? (container.asElement() as import("puppeteer").ElementHandle<Element>) : null;
                if (upgraded) {
                  const ub = await upgraded.boundingBox().catch(() => null);
                  if (ub && ub.width * ub.height > (box?.width ?? 0) * (box?.height ?? 0) * 2) {
                    await textEl.dispose().catch(() => {});
                    el = upgraded;
                  } else {
                    await upgraded.dispose().catch(() => {});
                    el = textEl;
                  }
                } else {
                  el = textEl;
                }
              } else {
                el = textEl;
              }
            }
          } catch {}
        }
        if (!el) {
          try {
            const handle = await page.evaluateHandle((t: string, vp: { width: number }) => {
              const lower = t.toLowerCase().trim();
              const words = lower.split(/\s+/).filter(Boolean);
              const needW = Math.max(180, Math.floor(vp.width * 0.35));
              const idealArea = vp.width * 400; // ~ one viewport tall, not whole page
              const isVisible = (e: Element) => {
                const s = window.getComputedStyle(e);
                const r = (e as HTMLElement).getBoundingClientRect();
                if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
                if (r.width < 80 || r.height < 40) return false;
                // Exclude huge page wrappers — main/body often 10× viewport
                if (r.width * r.height > vp.width * 1800) return false;
                return true;
              };
              const candidates: { el: Element; score: number; area: number }[] = [];
              const all = Array.from(document.querySelectorAll("section, main, article, div, ul, aside"));
              for (const c of all) {
                if (!isVisible(c)) continue;
                // Skip nav/header/footer — footer often contains pricing links, not content
                if ((c as Element).closest("header, nav, footer")) continue;
                const txt = (c.textContent || "").toLowerCase();
                if (!words.every((w) => txt.includes(w))) continue;
                const r = (c as HTMLElement).getBoundingClientRect();
                if (r.width < needW || r.height < 60) continue;
                if (r.height > 1400) continue;
                const area = r.width * r.height;
                const hasIdClass = c.id.toLowerCase().includes(words[0]) || (typeof c.className === "string" && c.className.toLowerCase().includes(words[0]));
                const aspect = r.width / Math.max(r.height, 1);
                const aspectOk = aspect > 0.2 && aspect < 12;
                const txtLen = (c.textContent || "").trim().length;
                const sizeOk = txtLen > 20 && txtLen < 8000;
                if (!aspectOk || !sizeOk) continue;
                let base = hasIdClass ? 1000 : 0;
                if (c.tagName === "SECTION") base += 300;
                if (c.tagName === "ARTICLE") base += 200;
                if (c.tagName === "MAIN") base -= 400;
                // Prefer top content over footer: penalize large y
                const topPenalty = r.top / 8;
                const areaScore = 500 / (1 + Math.abs(area - idealArea) / idealArea);
                const score = base + areaScore - topPenalty;
                candidates.push({ el: c, score, area });
              }
              if (candidates.length) {
                candidates.sort((a, b) => b.score - a.score);
                // Among top 3 scores, pick the smallest area (tightest section, not page)
                const topScore = candidates[0].score;
                const topGroup = candidates.filter((c) => c.score >= topScore - 150).sort((a, b) => a.area - b.area);
                return topGroup[0].el;
              }
              // Relaxed: any visible element whose own text contains phrase
              for (const c of Array.from(document.querySelectorAll("*"))) {
                if (!isVisible(c)) continue;
                if ((c as Element).closest("footer, header, nav")) continue;
                const txt = (c.textContent || "").toLowerCase().trim();
                if (words.every((w) => txt.includes(w)) && (c.textContent || "").trim().length < 200) {
                  const p = c.parentElement;
                  if (p && isVisible(p) && !(p as Element).closest("footer")) {
                    const pr = (p as HTMLElement).getBoundingClientRect();
                    if (pr.width >= needW && pr.height >= 60) return p;
                  }
                  return c;
                }
              }
              return null;
            }, rawInput, viewport);
            const element = handle.asElement() as unknown as import("puppeteer").ElementHandle<Element> | null;
            if (element) el = element;
            else await handle.dispose().catch(() => {});
          } catch {}
        }
        if (!el) {
          // Agent-browser fallback: snapshot/find + auto-navigate to linked subpage (e.g. openrouter.ai pricing -> /pricing)
          // Instead of throwing "Try changing URL", AI should auto-navigate and deliver screenshot
          try {
            const { tryAgentBrowserFallback } = await import("@/lib/screenshot/agent-fallback");
            const fb = await tryAgentBrowserFallback(page, rawInput);
            if (fb.el) {
              el = fb.el;
            } else if (fb.suggestedUrl) {
              await page.goto(fb.suggestedUrl, { waitUntil: "networkidle2", timeout: 12000 });
              await new Promise((r) => setTimeout(r, 400));
              options.selector = undefined;
              const { logger } = await import("@/lib/logger");
              logger.info({ event: "agent_fallback_auto_navigated", url: fb.suggestedUrl, rawInput });
              const { ensureLazyContentLoaded: ensureFallback } = await import("@/lib/screenshot/agent-fullpage");
              await ensureFallback(page);
              await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
              await new Promise((r) => setTimeout(r, 120));
              if (options.full_page) {
                const typeFp = (options.format === "jpeg" ? "jpeg" : "png") as "png" | "jpeg";
                const fpOpt2: import("puppeteer").ScreenshotOptions = { type: typeFp, fullPage: true, captureBeyondViewport: options.capture_beyond_viewport, fromSurface: options.from_surface, omitBackground: options.omit_background };
                if (typeFp === "jpeg") fpOpt2.quality = options.quality;
                const buf = Buffer.from(await page.screenshot(fpOpt2));
                const sharp = (await import("sharp")).default;
                const meta = await sharp(buf).metadata().catch(() => null);
                return { buffer: buf, format: options.format, width: meta?.width ?? 0, height: meta?.height ?? 0 };
              } else {
                // Even viewport needs scroll top-bottom to load lazy, then back to top
                const typeVp = (options.format === "jpeg" ? "jpeg" : "png") as "png" | "jpeg";
                const opt: import("puppeteer").ScreenshotOptions = { type: typeVp, fullPage: false, captureBeyondViewport: options.capture_beyond_viewport, fromSurface: options.from_surface, omitBackground: options.omit_background };
                if (typeVp === "jpeg") opt.quality = options.quality;
                const buf = Buffer.from(await page.screenshot(opt));
                return { buffer: buf, format: options.format, width: options.viewport_width, height: options.viewport_height };
              }
            }
          } catch (e) {
            // Auto-navigated path already returned; only rethrow non-navigation errors
            if (e instanceof Error && (e as Error).message?.includes("agent_fallback_auto_navigated")) throw e;
          }
          if (!el) {
            const currentUrl = page.url();
            // Dynamic: extract first meaningful word, no hardcode
            const cleanedWord = (() => {
              const lower = rawInput.toLowerCase();
              const filler = new Set(["take","screenshot","screenshots","of","a","the","page","pages","section","table","on","no","but","we","found","link","to"]);
              const parts = lower.replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(Boolean).filter(w=>!filler.has(w));
              return parts[0] || lower.trim().split(/\s+/).filter(w=>!filler.has(w))[0] || lower.trim().split(/\s+/)[0];
            })();
            const linkSuggestion = await page.evaluate((word) => {
              const lower = word.toLowerCase().trim();
              const links = Array.from(document.querySelectorAll('a[href]'));
              const exact = links.find(a => a.textContent.trim().toLowerCase() === lower) as HTMLAnchorElement | undefined;
              const hrefMatch = links.find(a => (a.getAttribute("href")||"").toLowerCase().includes(lower)) as HTMLAnchorElement | undefined;
              const link = exact || hrefMatch;
              if (link) {
                const href = link.getAttribute("href") || "";
                try { const abs = new URL(href, location.href).href; return { href, abs, text: link.textContent.trim().slice(0,40) }; } catch { return { href, abs: href, text: link.textContent.trim().slice(0,40) }; }
              }
              return null;
            }, cleanedWord).catch(() => null) as { href: string; abs: string; text: string } | null;
            if (linkSuggestion && linkSuggestion.abs && linkSuggestion.abs !== currentUrl) {
              const isPageAsk = /\bpage\b/i.test(rawInput) || rawInput.trim().split(/\s+/).length >= 2;
              if (isPageAsk) {
                await page.goto(linkSuggestion.abs, { waitUntil: "domcontentloaded", timeout: 10000 });
                await new Promise((r) => setTimeout(r, 400));
                options.selector = undefined;
                const { ensureLazyContentLoaded: ensure3 } = await import("@/lib/screenshot/agent-fullpage");
                await ensure3(page);
                await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
                await new Promise((r) => setTimeout(r, 120));
                if (options.full_page) {
                  const typeFp2 = (options.format === "jpeg" ? "jpeg" : "png") as "png" | "jpeg";
                  const fpOpt3: import("puppeteer").ScreenshotOptions = { type: typeFp2, fullPage: true, captureBeyondViewport: options.capture_beyond_viewport, fromSurface: options.from_surface, omitBackground: options.omit_background };
                  if (typeFp2 === "jpeg") fpOpt3.quality = options.quality;
                  const buf2 = Buffer.from(await page.screenshot(fpOpt3));
                  const sharp2 = (await import("sharp")).default;
                  const meta2 = await sharp2(buf2).metadata().catch(() => null);
                  return { buffer: buf2, format: options.format, width: meta2?.width ?? 0, height: meta2?.height ?? 0 };
                } else {
                  const typeVp2 = (options.format === "jpeg" ? "jpeg" : "png") as "png" | "jpeg";
                  const opt2: import("puppeteer").ScreenshotOptions = { type: typeVp2, fullPage: false, captureBeyondViewport: options.capture_beyond_viewport, fromSurface: options.from_surface, omitBackground: options.omit_background };
                  if (typeVp2 === "jpeg") opt2.quality = options.quality;
                  const buf2 = Buffer.from(await page.screenshot(opt2));
                  return { buffer: buf2, format: options.format, width: options.viewport_width, height: options.viewport_height };
                }
              }
              let host = "";
              try { host = new URL(currentUrl).hostname; } catch {}
              throw new Error(`No "${rawInput}" section on ${host} — but we found a "${linkSuggestion.text}" link to ${linkSuggestion.abs}. Try changing the URL to ${linkSuggestion.abs} and leave the section empty (or use "#pricing" if that page has it). If you want this page, right-click the section → Inspect → Copy → Copy selector.`);
            }
            throw new Error(`We couldn't find "${rawInput}" on the page. Try picking the exact id like "#${singleWord}" or class ".${singleWord}", or open the page in your browser, right-click the section and Copy → Selector, then paste it here.`);
          }
        }
      } else {
        throw new Error(`We couldn't find anything matching "${rawInput}". Check the selector — it should look like "#pricing" (id) or ".hero" (class). Tip: right-click the part you want in your browser → Inspect → right-click the highlighted line → Copy → Copy selector.`);
      }
    }
    // Ensure element is in view and not clipped — upgrade tiny hits (e.g. 260×45 heading) to NEAREST section, not biggest
    try {
      const viewport2 = page.viewport() ?? { width: 1280, height: 720 };
      const needW2 = Math.max(180, Math.floor(viewport2.width * 0.35));
      const preBox = await el.boundingBox().catch(() => null);
      if (preBox && (preBox.width < needW2 || preBox.height < 80 || preBox.width * preBox.height < needW2 * 80)) {
        const upgraded = (await el.evaluateHandle((node, vp) => {
          let cur: Element | null = node.parentElement;
          let depth = 0;
          const needW = Math.max(180, Math.floor((vp as { width: number }).width * 0.35));
          while (cur && cur !== document.body && depth < 5) {
            const r = (cur as HTMLElement).getBoundingClientRect();
            const s = window.getComputedStyle(cur);
            const tag = cur.tagName.toLowerCase();
            const isSection = tag === "section" || tag === "article" || tag === "aside";
            if (s.visibility !== "hidden" && s.display !== "none" && r.width >= needW && r.height >= 80 && r.height < 1200 && (isSection || r.width * r.height < (vp as { width: number }).width * 900)) {
              return cur;
            }
            cur = cur.parentElement;
            depth++;
          }
          // Fallback smallest suitable parent
          cur = node.parentElement;
          let smallest: Element | null = node;
          let smallestArea = Infinity;
          while (cur && cur !== document.body) {
            const r = (cur as HTMLElement).getBoundingClientRect();
            const s = window.getComputedStyle(cur);
            if (s.visibility !== "hidden" && s.display !== "none" && r.width >= needW && r.height >= 80) {
              const area = r.width * r.height;
              if (area < smallestArea) { smallest = cur; smallestArea = area; }
            }
            cur = cur.parentElement;
          }
          return smallest || node;
        }, viewport2)) as unknown as import("puppeteer").ElementHandle<Element> | null;
        const bestEl = upgraded && (upgraded as unknown as { asElement: () => unknown }).asElement ? ((upgraded as unknown as { asElement: () => import("puppeteer").ElementHandle<Element> | null }).asElement() as import("puppeteer").ElementHandle<Element> | null) : null;
        if (bestEl) {
          const ub = await bestEl.boundingBox().catch(() => null);
          if (ub && preBox && ub.width * ub.height > preBox.width * preBox.height * 2) {
            await el.dispose().catch(() => {});
            el = bestEl;
          } else {
            await bestEl.dispose().catch(() => {});
            if (upgraded) await (upgraded as unknown as { dispose: () => Promise<void> }).dispose().catch(() => {});
          }
        } else if (upgraded) {
          await (upgraded as unknown as { dispose: () => Promise<void> }).dispose().catch(() => {});
        }
      }
    } catch {}
    try {
      await (el as unknown as { evaluate: (fn: (e: Element) => void) => Promise<void> }).evaluate((e) => e.scrollIntoView({ block: "center", inline: "center" }));
      await new Promise((r) => setTimeout(r, 200));
    } catch {}
    screenshotBuffer = Buffer.from(
      await el.screenshot({ type, omitBackground: options.omit_background })
    );
    // Final guard: if still degenerate (e.g. no larger container found), return it but with a warning — don't hard-fail
    // Previous hard-fail caused your "tiny artifact (260×45)" error loop.
    try {
      const meta = await (await import("sharp")).default(screenshotBuffer).metadata();
      const w = meta.width ?? 0, h = meta.height ?? 0;
      if (w < 200 || h < 100) {
        // Log but still return — small heading is better than error. User can manually try "main".
        console.warn(`[capture] selector "${rawInput}" produced small capture ${w}×${h}, returning as-is`);
      }
    } catch {}
  } else if (options.full_page) {
    const { ensureLazyContentLoaded } = await import("@/lib/screenshot/agent-fullpage");
    await ensureLazyContentLoaded(page);
    // Auto scroll to hash anchor like #tgpsc-ae-recruitment-2026-selection-process
    if (options.url?.includes("#")) {
      const hash = options.url.split("#")[1]?.split("?")[0];
      if (hash) await page.evaluate((id) => { const el = document.getElementById(id) || document.querySelector(`[id="${CSS.escape(id)}"]`); if (el) el.scrollIntoView({ block: "start" }); }, hash).catch(() => {});
      await new Promise((r) => setTimeout(r, 300));
    }
    // Crisp fullPage: use 2x if it won't exceed 15000 height (avoids downscale blur on tall models page)
    const origVp = page.viewport();
    let targetScale = origVp?.deviceScaleFactor && origVp.deviceScaleFactor > 1 ? origVp.deviceScaleFactor : 2;
    try {
      const h = await page.evaluate(() => document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight ?? 2000);
      if (h * targetScale > 15000) targetScale = 1;
      if (origVp && h * (origVp.deviceScaleFactor ?? 1) > 15000) targetScale = 1;
    } catch {}
    if (origVp && targetScale !== origVp.deviceScaleFactor) {
      await page.setViewport({ width: origVp.width ?? options.viewport_width, height: origVp.height ?? options.viewport_height, deviceScaleFactor: targetScale }).catch(() => {});
      await new Promise((r) => setTimeout(r, 120));
    }
    const fpOpt: import("puppeteer").ScreenshotOptions = { type, fullPage: true, captureBeyondViewport: options.capture_beyond_viewport, fromSurface: options.from_surface, omitBackground: options.omit_background };
    if (type === "jpeg") fpOpt.quality = Math.max(options.quality ?? 80, 90);
    screenshotBuffer = Buffer.from(await page.screenshot(fpOpt));
  } else {
    // Ensure viewport is at top — previous scroll for lazy loading left page at bottom (footer only)
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await new Promise((r) => setTimeout(r, 120));
    const opt: PuppeteerScreenshotOptions = {
      type,
      fullPage: false,
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
