import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

/**
 * Agent-browser inspired clean — mirrors:
 *   agent-browser network route <url> --abort --resource-type
 *   agent-browser snapshot -i  (find covering banner)
 *   click fails early when covered by <div#consent> -> dismiss then retry
 *
 * Called after navigation, before screenshot, as extra layer on top of
 * blocker.ts (@cliqz/adblocker) + clean-presets.ts CSS hide.
 */

const DISMISS_TEXT_RE = /(accept|agree|allow|got it|ok|close|dismiss|continue|not now|reject|decline)/i;
const BANNER_TEXT_RE = /(cookie|consent|privacy|tracking|subscribe|newsletter|sign up|chat|help)/i;

/**
 * Find elements that cover the viewport centre (like consent banners/modals)
 * — same check agent-browser does for "covered by <div#banner>" error.
 * Returns selectors/refs to dismiss.
 */
async function findCoveringOverlays(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const hits: { sel: string; z: number; area: number }[] = [];

    // Check centre + 4 nearby points to catch full-width banners that don't hit exact centre
    const points = [
      [cx, cy],
      [cx, 80],
      [cx, window.innerHeight - 80],
      [50, cy],
      [window.innerWidth - 50, cy],
    ];

    const seen = new Set<Element>();
    for (const [x, y] of points) {
      const el = document.elementFromPoint(x, y);
      if (!el || seen.has(el)) continue;
      seen.add(el);
      // Walk up to find fixed/modal container
      let cur: Element | null = el;
      let depth = 0;
      while (cur && cur !== document.body && depth < 4) {
        const s = window.getComputedStyle(cur as HTMLElement);
        const r = (cur as HTMLElement).getBoundingClientRect();
        const isFixed = s.position === "fixed" || s.position === "sticky";
        const z = parseInt(s.zIndex || "0", 10);
        const coversWide = r.width > window.innerWidth * 0.6 && r.height > 80;
        const coversTall = r.height > window.innerHeight * 0.5;
        const looksLikeBanner =
          (cur.id && /cookie|consent|banner|modal|popup|newsletter|chat|intercom|crisp|drift|tawk/i.test(cur.id)) ||
          (typeof (cur as HTMLElement).className === "string" && /cookie|consent|banner|modal|popup|newsletter|chat|intercom|crisp|drift|tawk/i.test((cur as HTMLElement).className)) ||
          BANNER_TEXT_RE.test((cur.textContent || "").slice(0, 200));

        if ((isFixed && z > 5) || coversWide || coversTall || (looksLikeBanner && r.width > 200)) {
          // Build a stable selector for this overlay
          let sel = cur.tagName.toLowerCase();
          if ((cur as HTMLElement).id) sel += `#${(cur as HTMLElement).id}`;
          else if (typeof (cur as HTMLElement).className === "string" && (cur as HTMLElement).className.trim()) {
            const firstCls = (cur as HTMLElement).className.trim().split(/\s+/)[0];
            if (firstCls) sel += `.${firstCls}`;
          }
          hits.push({ sel, z: isNaN(z) ? 0 : z, area: r.width * r.height });
          break;
        }
        cur = cur.parentElement;
        depth++;
      }
    }
    // De-dupe and sort by z-index (topmost first)
    const uniq = [...new Map(hits.map((h) => [h.sel, h])).values()];
    uniq.sort((a, b) => b.z - a.z || b.area - a.area);
    return uniq.map((h) => h.sel).slice(0, 3);
  });
}

async function tryDismiss(page: Page, overlaySel: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const overlay = document.querySelector(sel);
    if (!overlay) return false;
    // Try to find a close/accept button inside
    const btns = Array.from(overlay.querySelectorAll('button, [role="button"], a, [aria-label]'));
    const dismissBtn = btns.find((b) => {
      const t = (b.textContent || "").trim();
      const aria = (b.getAttribute("aria-label") || "").trim();
      return DISMISS_TEXT_RE.test(t) || DISMISS_TEXT_RE.test(aria) || /×|✕|✖/.test(t);
    }) as HTMLElement | undefined;
    if (dismissBtn) {
      (dismissBtn as HTMLElement).click();
      return true;
    }
    // Fallback: hide the overlay
    (overlay as HTMLElement).style.setProperty("display", "none", "important");
    return true;
  }, overlaySel).catch(() => false);
}

/**
 * Agent-browser style overlay dismiss: snapshot-like detection of covering
 * banners, then click dismiss button or hide. Mirrors:
 *   agent-browser snapshot -i
 *   agent-browser click @e2  # fails if covered by #consent-banner
 *   -> dismiss covering element, fresh snapshot, retry
 */
export async function dismissOverlaysWithSnapshot(page: Page): Promise<void> {
  try {
    const sels = await findCoveringOverlays(page);
    if (sels.length === 0) return;
    logger.info({ event: "agent_clean_overlays_found", count: sels.length, sels });
    for (const sel of sels) {
      const did = await tryDismiss(page, sel);
      if (did) {
        // Give animation time after dismiss, like agent-browser wait
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    // Also hide any remaining fixed high-z elements that are not part of main content
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("*"));
      for (const el of els) {
        const s = window.getComputedStyle(el as HTMLElement);
        const r = (el as HTMLElement).getBoundingClientRect();
        if (s.position === "fixed" && parseInt(s.zIndex || "0", 10) > 999 && r.height > window.innerHeight * 0.4) {
          // Likely a full-screen modal
          (el as HTMLElement).style.setProperty("display", "none", "important");
        }
      }
    });
  } catch (e) {
    logger.warn({ event: "agent_clean_dismiss_failed", error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Agent-browser style network routing: `network route <url> --abort --resource-type`
 * Enhances existing blocker.ts by also aborting by resource-type when
 * block_* flags are set, before the adblocker runs.
 * Call this BEFORE navigation, mirrors `agent-browser network route '*' --abort --resource-type image` etc.
 */
export async function setupAgentNetworkRoutes(page: Page, opts: { blockImages?: boolean; blockMedia?: boolean }): Promise<void> {
  // This is a lightweight extra — main blocking still via blocker.ts + engine.ts request interception.
  // Here we just ensure image/media routes are registered early like `network route`.
  // Actual interception is set up in engine.ts; this is a no-op placeholder for future `network har` etc.
  void page;
  void opts;
}
