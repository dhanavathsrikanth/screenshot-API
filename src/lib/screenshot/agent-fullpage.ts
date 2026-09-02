import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

/**
 * Agent-browser inspired full-page + lazy handling
 * Mirrors:
 *   agent-browser scroll down 800  (repeat until no growth)
 *   agent-browser wait --load networkidle
 *   agent-browser snapshot -s "#main" (check new nodes)
 *   agent-browser scrollintoview <sel> for lazy images
 *
 * Called before capture when full_page=true, and also used inside
 * captureFullPageStitched for more robust stitching.
 */

export async function ensureLazyContentLoaded(page: Page): Promise<void> {
  try {
    // Force lazy images into view like `scrollintoview` for each lazy node
    await page.evaluate(async () => {
      const lazyEls = Array.from(document.querySelectorAll('img[loading="lazy"], [data-src], [data-lazy]'));
      for (const el of lazyEls.slice(0, 20)) {
        try {
          (el as HTMLElement).scrollIntoView({ block: "center" });
          // also trigger native lazy via IntersectionObserver
          if ((el as HTMLImageElement).dataset?.src) {
            (el as HTMLImageElement).src = (el as HTMLImageElement).dataset.src!;
          }
        } catch {}
      }
    });
    // Give observer a tick
    await new Promise((r) => setTimeout(r, 200));

    // Agent-browser style: scroll down in viewport steps, snapshot-like check for growth
    await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const step = window.innerHeight || 800;
      let passesWithoutGrowth = 0;
      let lastHeight = document.scrollingElement?.scrollHeight ?? 0;
      let lastCount = document.querySelectorAll("img, section, article").length;

      while (passesWithoutGrowth < 3) {
        const startHeight = document.scrollingElement?.scrollHeight ?? 0;
        const startCount = document.querySelectorAll("img, section, article").length;

        // Scroll down step-by-step like `agent-browser scroll down`
        let top = document.scrollingElement?.scrollTop ?? 0;
        while (true) {
          window.scrollBy(0, step);
          top += step;
          const el = document.scrollingElement!;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) break;
          await sleep(40);
        }
        await sleep(150);

        // Snapshot-like: check if new lazy nodes appeared or height grew
        const endHeight = document.scrollingElement?.scrollHeight ?? 0;
        const endCount = document.querySelectorAll("img, section, article").length;
        const grew = endHeight > startHeight + 20 || endCount > startCount;

        // Also force any newly revealed lazy images into view
        if (grew) {
          const newImgs = Array.from(document.querySelectorAll('img[loading="lazy"]')).slice(-10);
          for (const img of newImgs) {
            (img as HTMLElement).scrollIntoView({ block: "center" });
            await sleep(30);
          }
        }

        if (!grew && endHeight === lastHeight && endCount === lastCount) {
          passesWithoutGrowth++;
        } else {
          passesWithoutGrowth = 0;
        }
        lastHeight = endHeight;
        lastCount = endCount;
        if (passesWithoutGrowth >= 3) break;
      }
      window.scrollTo(0, 0);
      await sleep(100);
    });

    // Final network-idle like `agent-browser wait --load networkidle` (bounded)
    await page.evaluate(async () => {
      // Wait a short time for any remaining image loads, like readiness waitForImages
      const imgs = Array.from(document.images);
      if (imgs.length === 0) return;
      await Promise.race([
        Promise.all(
          imgs.map(
            (img) =>
              new Promise<void>((res) => {
                if (img.complete) return res();
                img.addEventListener("load", () => res(), { once: true });
                img.addEventListener("error", () => res(), { once: true });
                setTimeout(() => res(), 2000);
              })
          )
        ),
        new Promise<void>((res) => setTimeout(() => res(), 1500)),
      ]);
    });
    logger.info({ event: "agent_fullpage_lazy_done" });
  } catch (e) {
    logger.warn({ event: "agent_fullpage_lazy_failed", error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Enhanced stitched capture that also ensures lazy content per tile,
 * mirroring `agent-browser scroll` + `snapshot` per viewport.
 */
export async function captureFullPageStitchedAgent(
  page: Page,
  type: "png" | "jpeg",
  originalFn: (page: Page, type: "png" | "jpeg") => Promise<Buffer>
): Promise<Buffer> {
  // Pre-warm lazy content before stitching
  await ensureLazyContentLoaded(page);
  // Delegate to original stitched capture (now with content already loaded)
  return originalFn(page, type);
}
