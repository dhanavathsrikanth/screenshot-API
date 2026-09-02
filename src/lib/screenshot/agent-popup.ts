import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

/**
 * Remove scroll-triggered popups/dialogs — mirrors:
 * agent-browser snapshot -> find [role=dialog] covering center -> click close
 * agent-browser scroll down (triggers popup) -> dismiss
 */
export async function dismissScrollPopups(page: Page): Promise<number> {
  let dismissed = 0;
  try {
    // Trigger scroll popups by scrolling a bit like ensureLazyContentLoaded
    await page.evaluate(async () => {
      window.scrollBy(0, 400);
      await new Promise(r => setTimeout(r, 300));
      window.scrollBy(0, -400);
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 400));

    const toClick = await page.evaluate(() => {
      const candidates: string[] = [];
      // dialog roles
      document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]').forEach(el => {
        const s = window.getComputedStyle(el as HTMLElement);
        const r = (el as HTMLElement).getBoundingClientRect();
        if (s.display !== "none" && s.visibility !== "hidden" && r.width > 200 && r.height > 100) {
          const close = (el as HTMLElement).querySelector('button[aria-label*="close" i], button[aria-label*="Close"], .close, [class*="close" i], button:has-text("×")') as HTMLElement | null;
          if (close) candidates.push(close.outerHTML.slice(0,80));
          else candidates.push((el as HTMLElement).outerHTML.slice(0,80));
        }
      });
      // common popup classes
      document.querySelectorAll('.modal, .popup, .newsletter-popup, .subscribe-popup, [class*="popup" i], [class*="modal" i], [id*="popup" i]').forEach(el => {
        const s = window.getComputedStyle(el as HTMLElement);
        const r = (el as HTMLElement).getBoundingClientRect();
        if (s.display !== "none" && s.visibility !== "hidden" && r.width > 250 && r.height > 120 && parseInt(s.zIndex) > 10) {
          candidates.push((el as HTMLElement).outerHTML.slice(0,80));
        }
      });
      return candidates.slice(0, 3);
    });

    // Find close buttons via evaluate and click
    const closeSelectors = [
      '[role="dialog"] button[aria-label*="close" i]',
      '[role="dialog"] .close',
      '[aria-modal="true"] button',
      '.modal button.close',
      '.popup button.close',
      '[class*="popup"] button',
      'button:has-text("×")',
      'button:has-text("Close")',
    ];
    for (const sel of closeSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          const box = await el.boundingBox().catch(() => null);
          if (box && box.width > 5) {
            await el.click().catch(() => {});
            dismissed++;
            await new Promise(r => setTimeout(r, 300));
            if (dismissed >= 2) break;
          }
        }
      } catch {}
    }

    // Fallback: hide any visible dialog/modal via CSS
    if (dismissed === 0) {
      const hidden = await page.evaluate(() => {
        let n = 0;
        document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], .modal, .popup, [class*="modal"], [class*="popup"]').forEach(el => {
          const s = window.getComputedStyle(el as HTMLElement);
          const r = (el as HTMLElement).getBoundingClientRect();
          if (s.display !== "none" && r.width > 200 && r.height > 100) {
            (el as HTMLElement).style.setProperty("display", "none", "important");
            n++;
          }
        });
        // also remove overlay backdrops
        document.querySelectorAll('.overlay, .backdrop, [class*="overlay" i], [class*="backdrop" i]').forEach(el => {
          const s = window.getComputedStyle(el as HTMLElement);
          if (s.display !== "none" && parseInt(s.zIndex) > 50) {
            (el as HTMLElement).style.setProperty("display", "none", "important");
            n++;
          }
        });
        return n;
      });
      dismissed = hidden;
    }
    if (dismissed > 0) logger.info({ event: "scroll_popup_dismissed", count: dismissed });
    // Scroll back to top for capture
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  } catch (e) {
    logger.warn({ event: "scroll_popup_failed", error: e instanceof Error ? e.message : String(e) });
  }
  return dismissed;
}
