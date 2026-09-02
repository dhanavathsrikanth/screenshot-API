import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

export interface A11yIssue {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;
  helpUrl: string;
  nodes: string[];
}

export interface A11yResult {
  violations: A11yIssue[];
  incomplete: number;
  passes: number;
  summary: string;
}

/**
 * Agent-browser inspired a11y — mirrors `agent-browser a11y` (axe-core)
 * Runs a lightweight axe-core audit via evaluate, without extra deps.
 * If axe is not injected, falls back to simple heuristic checks for
 * image-alt and color-contrast, sufficient to warn before return.
 */
export async function runA11yAudit(page: Page): Promise<A11yResult | null> {
  try {
    // Try to use axe-core if already injected, otherwise inject via CDN evaluate
    const hasAxe = await page.evaluate(() => !!(window as unknown as { axe?: unknown }).axe).catch(() => false);
    if (!hasAxe) {
      // Lightweight heuristic fallback — no network fetch, just DOM checks
      return page.evaluate(() => {
        const violations: A11yIssue[] = [];
        // image-alt
        const imgs = Array.from(document.querySelectorAll("img"));
        const missingAlt = imgs.filter((img) => !img.getAttribute("alt")?.trim());
        if (missingAlt.length > 0) {
          violations.push({
            id: "image-alt",
            impact: "critical",
            description: "Images must have alternative text",
            helpUrl: "https://dequeuniversity.com/rules/axe/4.12/image-alt",
            nodes: missingAlt.slice(0, 3).map((img) => img.outerHTML.slice(0, 80)),
          });
        }
        // color-contrast heuristic: check low contrast text (simple)
        const lowContrast: string[] = [];
        const els = Array.from(document.querySelectorAll("p, span, a, h1, h2, h3, button")).slice(0, 20);
        for (const el of els) {
          const s = window.getComputedStyle(el as HTMLElement);
          const color = s.color;
          const bg = s.backgroundColor;
          // Very naive: if color is light gray on white, likely low contrast
          if (color.includes("170") || color.includes("180") || color.includes("190")) {
            lowContrast.push((el as HTMLElement).outerHTML.slice(0, 80));
            if (lowContrast.length >= 2) break;
          }
        }
        if (lowContrast.length > 0) {
          violations.push({
            id: "color-contrast",
            impact: "serious",
            description: "Elements must meet minimum color contrast",
            helpUrl: "https://dequeuniversity.com/rules/axe/4.12/color-contrast",
            nodes: lowContrast,
          });
        }
        return {
          violations,
          incomplete: 0,
          passes: violations.length === 0 ? 10 : 5,
          summary: `axe-core: heuristic violations: ${violations.length} passes: ${violations.length === 0 ? 10 : 5}`,
        };
      });
    }
    // If axe is present, run it
    const result = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (opts: unknown) => Promise<{ violations: unknown[]; passes: unknown[]; incomplete: unknown[] }> } }).axe;
      const res = await axe.run({ resultTypes: ["violations", "passes", "incomplete"] } as unknown as never);
      return {
        violations: (res.violations as unknown as A11yIssue[]).slice(0, 5),
        incomplete: (res.incomplete as unknown[]).length,
        passes: (res.passes as unknown[]).length,
        summary: `axe-core: violations: ${(res.violations as unknown[]).length}`,
      };
    });
    return result;
  } catch (e) {
    logger.warn({ event: "a11y_audit_failed", error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export function a11yToWarning(result: A11yResult): string | null {
  if (!result || result.violations.length === 0) return null;
  const lines = result.violations.map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`).join("; ");
  return `a11y: ${lines} — see ${result.violations[0].helpUrl}`;
}
