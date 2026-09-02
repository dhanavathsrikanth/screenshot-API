import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

/**
 * Agent-browser inspired annotate + highlight — mirrors:
 *   agent-browser screenshot --annotate  (numbered [1]→@e1)
 *   agent-browser highlight <sel>
 *   agent-browser snapshot -i (for @e refs)
 *
 * Used for dashboard preview debug: overlay numbered labels on interactive
 * elements, cache refs, and allow `highlight @e1` debugging.
 */

export interface AnnotatedRef {
  ref: string;
  role: string;
  name: string;
  box: { x: number; y: number; width: number; height: number };
}

/**
 * Inject numbered labels [1],[2]... over interactive elements, like `screenshot --annotate`.
 * Returns refs map and cleans up after 5s (or keep if needed).
 */
export async function annotatePage(page: Page): Promise<AnnotatedRef[]> {
  try {
    const refs = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('a, button, input, [role="button"], [tabindex]')).slice(0, 12);
      const out: { ref: string; role: string; name: string; box: { x: number; y: number; width: number; height: number } }[] = [];
      els.forEach((el, i) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width < 10 || r.height < 10) return;
        const style = window.getComputedStyle(el as HTMLElement);
        if (style.visibility === "hidden" || style.display === "none") return;
        const name = (el.textContent || el.getAttribute("aria-label") || (el as HTMLInputElement).placeholder || el.tagName).trim().slice(0, 30);
        const ref = `e${i + 1}`;
        // Create label
        const label = document.createElement("div");
        label.setAttribute("data-agent-annotate", ref);
        label.textContent = `[${i + 1}]`;
        label.style.position = "absolute";
        label.style.left = `${r.left + window.scrollX}px`;
        label.style.top = `${r.top + window.scrollY}px`;
        label.style.background = "#6366f1";
        label.style.color = "white";
        label.style.fontSize = "10px";
        label.style.fontWeight = "700";
        label.style.padding = "1px 4px";
        label.style.borderRadius = "4px";
        label.style.zIndex = "2147483647";
        label.style.pointerEvents = "none";
        label.style.fontFamily = "monospace";
        document.body.appendChild(label);
        out.push({ ref, role: (el.getAttribute("role") || el.tagName.toLowerCase()), name, box: { x: r.x, y: r.y, width: r.width, height: r.height } });
      });
      // Keep labels until page is closed / captured - cleared explicitly after screenshot
      return out;
    });
    logger.info({ event: "annotate_done", count: refs.length });
    return refs;
  } catch (e) {
    logger.warn({ event: "annotate_failed", error: e instanceof Error ? e.message : String(e) });
    return [];
  }
}

export async function highlightSelector(page: Page, selector: string): Promise<boolean> {
  try {
    const raw = selector.trim().replace(/^["']|["']$/g, "");
    const isBareWord = !/^[#.\[]/.test(raw) && !raw.includes(">") && !raw.includes("+") && !raw.includes("~") && !raw.includes(":");
    const ok = await page.evaluate((sel, bare) => {
      let el: HTMLElement | null = null;
      if (!bare) {
        try { el = document.querySelector(sel) as HTMLElement | null; } catch {}
      }
      if (!el && bare) {
        const w = sel.toLowerCase().trim().split(/\s+/)[0];
        // try #w, .w, [id*="w" i]
        el = (document.querySelector(`#${CSS.escape(w)}`) as HTMLElement | null)
          || (document.querySelector(`.${CSS.escape(w)}`) as HTMLElement | null)
          || (document.querySelector(`[id*="${w}" i], [class*="${w}" i]`) as HTMLElement | null);
        if (!el) {
          // text fallback: find element whose text contains w and upgrade to nearest section
          const all = Array.from(document.querySelectorAll("section, article, div, main, ul")) as HTMLElement[];
          for (const c of all) {
            if ((c.textContent || "").toLowerCase().includes(w)) {
              const r = c.getBoundingClientRect();
              const s = window.getComputedStyle(c);
              if (s.visibility !== "hidden" && s.display !== "none" && r.width > 180 && r.height > 60) { el = c; break; }
            }
          }
        }
        if (!el) {
          try { el = document.querySelector(`::-p-text(${sel})` as unknown as string) as HTMLElement | null; } catch {}
        }
      }
      if (!el) return false;
      // nearest suitable container if tiny hit
      const r0 = el.getBoundingClientRect();
      if (r0.width < 180 || r0.height < 60) {
        let cur: HTMLElement | null = el.parentElement as HTMLElement | null;
        let depth = 0;
        while (cur && cur !== document.body && depth < 6) {
          const r = cur.getBoundingClientRect();
          const s = window.getComputedStyle(cur);
          if (s.visibility !== "hidden" && s.display !== "none" && r.width >= 180 && r.height >= 60 && r.height < 1200) { el = cur; break; }
          cur = cur.parentElement as HTMLElement | null;
          depth++;
        }
      }
      el.style.outline = "3px solid #f59e0b";
      el.style.outlineOffset = "2px";
      el.style.backgroundColor = "rgba(245,158,11,0.15)";
      // label [1] @e1
      const rr = el.getBoundingClientRect();
      const label = document.createElement("div");
      label.setAttribute("data-agent-annotate", "hl");
      label.textContent = "[1] @e1";
      label.style.position = "absolute";
      label.style.left = `${rr.left + window.scrollX}px`;
      label.style.top = `${Math.max(0, rr.top + window.scrollY - 14)}px`;
      label.style.background = "#f59e0b";
      label.style.color = "white";
      label.style.fontSize = "10px";
      label.style.fontWeight = "700";
      label.style.padding = "1px 4px";
      label.style.borderRadius = "4px";
      label.style.zIndex = "2147483647";
      label.style.pointerEvents = "none";
      label.style.fontFamily = "monospace";
      document.body.appendChild(label);
      el.scrollIntoView({ block: "center", inline: "center" });
      return true;
    }, raw, isBareWord);
    return !!ok;
  } catch {
    return false;
  }
}

export async function clearAnnotations(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("[data-agent-annotate]").forEach((n) => n.remove());
  }).catch(() => {});
}
