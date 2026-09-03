import type { Page, ElementHandle } from "puppeteer";
import { logger } from "@/lib/logger";
import { loadAgentBrowserConfig } from "@/lib/agent-browser/config";

/**
 * Agent-browser inspired fallback for "capture a specific part" when deterministic
 * CSS/text heuristics fail (e.g. openrouter.ai + "pricing" where pricing is a nav link
 * to /pricing, not a section on the homepage).
 *
 * Mirrors agent-browser's snapshot/ref workflow:
 *   snapshot -i  -> accessibility tree with refs
 *   find text/role -> get box -> screenshot
 *   chat "find pricing section; if link to /pricing, navigate"
 *
 * In this service we reuse the existing Puppeteer `page` (no extra browser) and
 * emulate the snapshot logic. In production with `agent-browser` binary available,
 * this can shell out to `npx agent-browser --session` for full agentic flow.
 */

export interface AgentFallbackResult {
  el: ElementHandle<Element> | null;
  navigated?: boolean;
  suggestedUrl?: string;
}

function isAgentBrowserAvailable(): boolean {
  // Real detection: use the shared binary discovery so dev Windows and prod
  // Docker both work, instead of hardcoding Linux paths.
  try {
    return !!loadAgentBrowserConfig().binaryPath;
  } catch {
    return false;
  }
}

/**
 * Try the agentic fallback. Returns an ElementHandle if found, or null.
 * If the word is a nav link to a subpage (pricing -> /pricing) it will
 * optionally navigate the page to that subpage and then search there.
 */
export async function tryAgentBrowserFallback(
  page: Page,
  rawInput: string
): Promise<AgentFallbackResult> {
  const word = rawInput.trim().split(/\s+/)[0].toLowerCase();
  const phrase = rawInput.trim().toLowerCase();

  // 1) Quick check: is there an <a href*="pricing"> that is the only match?
  //    For openrouter.ai this is the signal to guide user to /pricing.
  try {
    const linkInfo = await page.evaluate((w) => {
      const lower = w.toLowerCase().trim().split(/\s+/)[0];
      const links = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
      const exact = links.find((a) => a.textContent.trim().toLowerCase() === lower);
      const hrefMatch = links.find((a) => (a.getAttribute("href") || "").toLowerCase().includes(lower));
      const link = exact || hrefMatch;
      if (!link) return null;
      return {
        href: link.getAttribute("href") || "",
        abs: (() => {
          try {
            return new URL(link.getAttribute("href") || "", location.href).href;
          } catch {
            return link.getAttribute("href") || "";
          }
        })(),
        text: link.textContent.trim().slice(0, 60),
        inHeader: !!link.closest("header, nav"),
      };
    }, rawInput).catch(() => null) as { href: string; abs: string; text: string; inHeader: boolean } | null;

    // If link is in header/nav and current page has no real pricing section,
    // we surface a navigated suggestion instead of returning a header screenshot.
    if (linkInfo && linkInfo.abs && linkInfo.inHeader) {
      const currentUrl = page.url();
      // Only suggest navigation if we haven't already navigated and link is different page
      if (linkInfo.abs !== currentUrl && linkInfo.abs.includes(word)) {
        logger.info({ event: "agent_fallback_link_suggest", word, from: currentUrl, to: linkInfo.abs });
        // Optionally auto-navigate for the fallback capture
        try {
          await page.goto(linkInfo.abs, { waitUntil: "networkidle2", timeout: 12000 });
          await new Promise((r) => setTimeout(r, 1500));
          // After navigation, retry finding pricing section on the new page
          const viewport = page.viewport() ?? { width: 1280, height: 720 };
          const el = await findPricingSection(page, phrase, viewport);
          if (el) return { el, navigated: true, suggestedUrl: linkInfo.abs };
          // If still not found on pricing page, just capture full page of pricing URL as value
          // Return null to let caller throw a helpful error with suggestedUrl
          return { el: null, suggestedUrl: linkInfo.abs };
        } catch (e) {
          logger.warn({ event: "agent_fallback_navigate_failed", error: e instanceof Error ? e.message : String(e) });
          return { el: null, suggestedUrl: linkInfo.abs };
        }
      }
    }
  } catch {}

  // 2) Snapshot-style search: emulate `snapshot -i` + `find text`
  //    Use accessibility + text search, excluding header/nav, preferring section.
  try {
    const viewport = page.viewport() ?? { width: 1280, height: 720 };
    const el = await findPricingSection(page, phrase, viewport);
    if (el) return { el };
  } catch (e) {
    logger.warn({ event: "agent_fallback_snapshot_failed", error: e instanceof Error ? e.message : String(e) });
  }

  // 3) If agent-browser binary is available, shell out to the real thing.
  //    Mirrors `agent-browser find text "<phrase>" text` + `find role`.
  //    The real binary runs its own browser, so we locate a matching element
  //    and surface a suggested selector; the primary Puppeteer page then
  //    captures it (no need to re-open the page).
  if (isAgentBrowserAvailable()) {
    try {
      const { runAgentBrowserData, closeAgentBrowserSession } = await import("@/lib/agent-browser/client");
      const session = `fallback-${Date.now().toString(36)}`;
      try {
        await runAgentBrowserData(["open", page.url()], { session, timeoutMs: 15_000 }).catch(() => {});
        const matches = await runAgentBrowserData<{ selector: string }[] | null>(
          ["find", "text", phrase.split(/\s+/)[0], "--json"],
          { session, timeoutMs: 15_000 }
        ).catch(() => null);
        if (matches && matches[0]?.selector) {
          logger.info({ event: "agent_browser_find_matched", phrase, selector: matches[0].selector });
          await closeAgentBrowserSession(session).catch(() => {});
          // Re-resolve on the Puppeteer page and return the element.
          const found = await page.$(matches[0].selector).catch(() => null);
          if (found) return { el: found };
        }
        await closeAgentBrowserSession(session).catch(() => {});
      } catch {
        await closeAgentBrowserSession(session).catch(() => {});
      }
    } catch {
      // shell-out failed — ignore and fall through
    }
  }

  return { el: null };
}

/**
 * Snapshot-inspired section finder — mirrors `agent-browser snapshot -i` + `find`
 * Picks smallest suitable section containing phrase, skipping header/nav.
 */
async function findPricingSection(
  page: Page,
  phrase: string,
  viewport: { width: number; height: number }
): Promise<ElementHandle<Element> | null> {
  const handle = await page.evaluateHandle(
    (t: string, vp: { width: number }) => {
      const lower = t.toLowerCase().trim();
      const words = lower.split(/\s+/).filter(Boolean);
      const needW = Math.max(180, Math.floor(vp.width * 0.35));
      const isVisible = (e: Element) => {
        const s = window.getComputedStyle(e);
        const r = (e as HTMLElement).getBoundingClientRect();
        if (s.visibility === "hidden" || s.display === "none" || (s as unknown as { opacity: string }).opacity === "0") return false;
        if (r.width < 80 || r.height < 40) return false;
        if (r.width * r.height > vp.width * 1800) return false;
        return true;
      };

      // Prefer elements that look like content sections, not nav
      const all = Array.from(document.querySelectorAll("section, article, div, ul, aside, main"));
      const candidates: { el: Element; score: number; area: number }[] = [];
      for (const c of all) {
        if (!isVisible(c)) continue;
        if ((c as Element).closest("header, nav, footer")) continue;
        const txt = (c.textContent || "").toLowerCase();
        if (!words.every((w) => txt.includes(w))) continue;
        const r = (c as HTMLElement).getBoundingClientRect();
        if (r.width < needW || r.height < 60 || r.height > 1400) continue;
        const area = r.width * r.height;
        const hasWord = c.id.toLowerCase().includes(words[0]) || (typeof (c as HTMLElement).className === "string" && (c as HTMLElement).className.toLowerCase().includes(words[0]));
        // Bonus for being near top of page but not header
        const top = r.top;
        let score = hasWord ? 1000 : 0;
        if (c.tagName === "SECTION") score += 300;
        if (c.tagName === "ARTICLE") score += 200;
        if (top < 200) score += 50;
        // Prefer moderate area close to viewport
        const ideal = vp.width * 400;
        score += 400 / (1 + Math.abs(area - ideal) / ideal);
        candidates.push({ el: c, score, area });
      }
      if (candidates.length) {
        candidates.sort((a, b) => b.score - a.score);
        const top = candidates[0].score;
        const topGroup = candidates.filter((c) => c.score >= top - 150).sort((a, b) => a.area - b.area);
        return topGroup[0].el;
      }
      return null;
    },
    phrase,
    viewport
  );
  const el = handle.asElement() as unknown as ElementHandle<Element> | null;
  if (el) return el;
  await handle.dispose().catch(() => {});
  return null;
}
