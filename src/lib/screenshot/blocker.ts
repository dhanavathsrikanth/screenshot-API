import { Page } from "puppeteer";
import { PuppeteerBlocker } from "@cliqz/adblocker-puppeteer";
import { logger } from "@/lib/logger";

/**
 * Ad / tracker / cookie-banner blocking (blueprint §32).
 *
 * The compiled blocking engine is fetched once and disk-cached in
 * `.cache/blocker.engine` (persists across deploys on Render), so cold
 * starts don't re-download the large filter lists.
 */

let cachedBlocker: PuppeteerBlocker | null = null;
let blockerPromise: Promise<PuppeteerBlocker> | null = null;

async function getBlocker(): Promise<PuppeteerBlocker> {
  if (cachedBlocker) return cachedBlocker;
  if (blockerPromise) return blockerPromise;

  blockerPromise = (async () => {
    const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    const cacheFile = join(process.cwd(), ".cache", "blocker.engine");

    let blocker: PuppeteerBlocker | null = null;
    try {
      if (existsSync(cacheFile)) {
        blocker = await PuppeteerBlocker.deserialize(readFileSync(cacheFile));
      }
    } catch (err) {
      logger.error({ event: "blocker_cache_load_failed", error: err instanceof Error ? err.message : err });
      blocker = null;
    }

    if (!blocker) {
      blocker = await PuppeteerBlocker.fromLists(globalThis.fetch, [
        "https://secure.fanboy.co.nz/fanboy-cookiemonster.txt",
        "https://easylist.to/easylist/easylist.txt",
      ]);
      try {
        mkdirSync(join(process.cwd(), ".cache"), { recursive: true });
        writeFileSync(cacheFile, blocker.serialize());
      } catch (err) {
        logger.error({ event: "blocker_cache_write_failed", error: err instanceof Error ? err.message : err });
      }
    }

    cachedBlocker = blocker;
    return blocker;
  })();

  return blockerPromise;
}

/** Enable ad/tracker/cookie-banner blocking on a page. */
export async function enableBlocking(page: Page): Promise<void> {
  const blocker = await getBlocker();
  await blocker.enableBlockingInPage(page);
}
