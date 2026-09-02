import { Page } from "puppeteer";
import type { ScreenshotOptions } from "@/lib/schema";

/**
 * Page preparation / readiness engine (blueprint §7–§12).
 *
 * Instead of a single hardcoded `waitUntil`, this module implements
 * ReadinessStrategy with four modes:
 *
 *   fast     — DOM loaded only
 *   balanced — DOM + fonts + images + short stability window
 *   complete — network idle + fonts + images + layout stability
 *   custom   — selector + delay + JS condition
 */

export type ReadinessMode = "fast" | "balanced" | "complete" | "custom";

export const READINESS_MODES: ReadinessMode[] = ["fast", "balanced", "complete", "custom"];

export function resolveReadinessMode(options: ScreenshotOptions): ReadinessMode {
  return options.readiness ?? defaultReadinessMode(options);
}

function defaultReadinessMode(options: ScreenshotOptions): ReadinessMode {
  if (options.wait_until === "networkidle0" || options.wait_until === "networkidle2") return "complete";
  return "balanced";
}

/** Effective Puppeteer `waitUntil` for the resolved strategy. */
export function resolveWaitUntil(options: ScreenshotOptions): "load" | "domcontentloaded" | "networkidle0" | "networkidle2" {
  if (options.wait_until) return options.wait_until;
  const mode = resolveReadinessMode(options);
  switch (mode) {
    case "complete":
      return "networkidle2";
    case "custom":
      return "domcontentloaded";
    case "fast":
      return "domcontentloaded";
    default:
      return "load";
  }
}

/**
 * Puppeteer's `page.setContent` only accepts `load` / `domcontentloaded`.
 * Network-idle waits are applied separately via the readiness engine.
 */
export function resolveSetContentWaitUntil(options: ScreenshotOptions): "load" | "domcontentloaded" {
  const waitUntil = resolveWaitUntil(options);
  return waitUntil === "domcontentloaded" ? "domcontentloaded" : "load";
}

/** Prevent fallback-font screenshots: wait for document.fonts.ready (bounded). */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      await Promise.race([
        fonts.ready,
        new Promise<void>((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
  });
}

/** Wait for all images to finish loading (bounded; failures resolve). */
export async function waitForImages(page: Page, timeoutMs = 5000): Promise<void> {
  await page.evaluate(async (budget) => {
    const deadline = Date.now() + budget;
    const images = Array.from(document.images);
    if (images.length === 0) return;

    const pending = images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const done = (): void => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        })
    );

    await Promise.race([
      Promise.all(pending),
      new Promise<void>((resolve) => setTimeout(resolve, Math.max(1, deadline - Date.now()))),
    ]);
  }, timeoutMs);
}

/**
 * Layout stability detection (blueprint §10). Watches document height and DOM
 * mutation activity; waits until the page stops moving for `quietMs`, bounded
 * by `timeoutMs`. Resolves either way — never hangs a render.
 */
export async function waitForLayoutStability(page: Page, quietMs = 400, timeoutMs = 3000): Promise<void> {
  await page.evaluate(
    ({ quiet, timeout }) =>
      new Promise<void>((resolve) => {
        const docEl = document.documentElement;
        const started = Date.now();
        let lastHeight = docEl.scrollHeight;
        let mutationBurst = 0;
        let stableSince: number | null = null;

        const observer = new MutationObserver(() => {
          mutationBurst++;
        });
        observer.observe(docEl, { childList: true, subtree: true, attributes: true, characterData: true });

        const finish = (): void => {
          observer.disconnect();
          resolve();
        };

        const check = (): void => {
          const now = Date.now();
          const height = docEl.scrollHeight;
          const heightChanged = height !== lastHeight;
          lastHeight = height;

          if (!heightChanged && mutationBurst < 3) {
            if (stableSince === null) stableSince = now;
            if (now - stableSince >= quiet) return finish();
          } else {
            stableSince = null;
            mutationBurst = 0;
          }

          if (now - started >= timeout) return finish();
          requestAnimationFrame(check);
        };

        requestAnimationFrame(check);
      }),
    { quiet: quietMs, timeout: timeoutMs }
  );
}

/** Wait for a CSS selector to appear in the DOM. */
export async function waitForSelector(page: Page, selector: string, timeoutMs: number): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { visible: true, timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/** Wait for text substring to appear — mirrors `agent-browser wait --text "Welcome"` */
export async function waitForText(page: Page, text: string, timeoutMs: number): Promise<boolean> {
  try {
    await page.waitForFunction(
      (t: string) => document.body.innerText.includes(t),
      { timeout: timeoutMs },
      text
    );
    return true;
  } catch {
    return false;
  }
}

/** Wait for URL pattern — mirrors agent-browser wait --url with ** wildcards */
export async function waitForUrl(page: Page, pattern: string, timeoutMs: number): Promise<boolean> {
  // ** -> .* , * -> [^/]* for simple glob
  const globToRegex = (glob: string) => {
    const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    return new RegExp("^" + esc.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$");
  };
  const deadline = Date.now() + timeoutMs;
  try {
    // Fast path: already matches
    if (globToRegex(pattern).test(page.url())) return true;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        page.off("framenavigated", onNav);
        reject(new Error("timeout"));
      }, Math.max(1, deadline - Date.now()));
      const onNav = () => {
        if (globToRegex(pattern).test(page.url())) {
          clearTimeout(timer);
          page.off("framenavigated", onNav);
          resolve();
        }
      };
      page.on("framenavigated", onNav);
    });
    return true;
  } catch {
    return false;
  }
}

/** Evaluate a JS expression in the page and wait until it is truthy. */
export async function waitForCondition(page: Page, expression: string, timeoutMs: number): Promise<void> {
  try {
    await page.waitForFunction(expression, { timeout: timeoutMs });
  } catch {
    // bounded — proceed with the capture anyway
  }
}

/**
 * Run the full readiness strategy against a page after navigation/content
 * has been set. Bounded everywhere — never blocks a render indefinitely.
 */
export async function applyReadiness(page: Page, options: ScreenshotOptions): Promise<void> {
  const mode = resolveReadinessMode(options);
  const timeoutMs = Math.min(options.timeout, 15_000);

  if (mode === "balanced" || mode === "complete") {
    await waitForFonts(page);
    await waitForImages(page, timeoutMs);
    await waitForLayoutStability(page, mode === "complete" ? 600 : 300, mode === "complete" ? 3000 : 1500);
  }

  if (mode === "custom") {
    // agent-browser wait primitives: --text, --url, selector, --fn
    if (options.wait_for_text) {
      await waitForText(page, options.wait_for_text, timeoutMs);
    }
    if (options.wait_for_url) {
      await waitForUrl(page, options.wait_for_url, timeoutMs);
    }
    if (options.wait_for_selector) {
      await waitForSelector(page, options.wait_for_selector, timeoutMs);
    }
    if (options.wait_for_condition) {
      await waitForCondition(page, options.wait_for_condition, timeoutMs);
    }
  }

  if (options.delay > 0) {
    const { sleep } = await import("@/lib/utils");
    await sleep(Math.min(options.delay, 1000));
  }
  // If any wait_* was requested but readiness wasn't custom, ensure it still ran
  // (fallback for direct /api/take callers that don't set readiness=custom)
  if (mode !== "custom") {
    if (options.wait_for_text) await waitForText(page, options.wait_for_text, timeoutMs);
    if (options.wait_for_url) await waitForUrl(page, options.wait_for_url, timeoutMs);
  }
}
