import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

/**
 * Agent-browser inspired chat single-shot — mirrors:
 *   agent-browser chat "take screenshot of pricing table"  (auto-navigates)
 *
 * Uses OpenRouter via Vercel AI SDK when OPENROUTER_API_KEY is set
 * (verified: openrouter.ai/docs/guides/community/vercel-ai-sdk +
 *  github.com/OpenRouterTeam/ai-sdk-provider — createOpenRouter + generateObject).
 * Falls back to heuristic regex when no key is configured.
 */

export interface ChatIntent {
  raw: string;
  target: string; // e.g. "pricing"
  wantsScreenshot: boolean;
  wantsNavigate: boolean;
}

function parseChatIntentHeuristic(input: string): ChatIntent {
  const raw = input.trim();
  const lower = raw.toLowerCase();
  // Robust: handle "take pricing page screenshots", "pricing page", "take screenshot of pricing table"
  const filler = new Set(["take", "a", "an", "the", "screenshot", "screenshots", "photo", "photos", "capture", "captures", "show", "me", "find", "please", "page", "pages", "table", "section"]);
  const words = lower.replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
  const meaningful = words.filter((w) => !filler.has(w));
  const targetFromMeaningful = meaningful[0];
  const targetMatch = lower.match(/(?:screenshot of|photo of|capture|show me|find)\s+(.+?)(?:\s+table|\s+section|\s+page)?$/);
  const targetFromRegex = targetMatch ? targetMatch[1].trim().split(/\s+/)[0] : null;
  const target = (targetFromMeaningful || targetFromRegex || words[0] || lower).replace(/[^a-z0-9-]/g, "") || "pricing";
  return {
    raw,
    target: target || "pricing",
    wantsScreenshot: /screenshot|photo|capture|image|picture/i.test(lower) || true,
    wantsNavigate: /take|go to|open|navigate|page/i.test(lower),
  };
}

async function parseChatIntent(input: string, domain?: string, linksHint?: string): Promise<ChatIntent> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return parseChatIntentHeuristic(input);
  try {
    const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
    const { generateObject } = await import("ai");
    const { z } = await import("zod");
    const openrouter = createOpenRouter({ apiKey });
    const modelId = process.env.OPENROUTER_MODEL || "openrouter/free";
    const domainCtx = domain ? `Domain: ${domain}. Current page links: ${linksHint || "unknown"}.` : "";
    const { object } = await generateObject({
      model: openrouter(modelId),
      schema: z.object({
        target: z.string().describe("single-word page/section id for this domain, e.g. pricing, models, docs"),
        wantsScreenshot: z.boolean(),
        wantsNavigate: z.boolean(),
      }),
      prompt: `${domainCtx} Extract browser intent for this domain. Examples: on openrouter.ai "take screenshot of pricing table" -> pricing; "models page" -> models; "show me docs" -> docs. Return one lower kebab word, stripped of take/screenshot/page. Input: "${input}"`,
    });
    return { raw: input.trim(), target: (object.target || "pricing").toLowerCase().replace(/[^a-z0-9-]/g, ""), wantsScreenshot: object.wantsScreenshot, wantsNavigate: object.wantsNavigate };
  } catch (e) {
    logger.warn({ event: "openrouter_parse_failed", error: e instanceof Error ? e.message : String(e) });
    return parseChatIntentHeuristic(input);
  }
}

export async function handleChatSingleShot(page: Page, input: string): Promise<{ selector: string | null; navigated: boolean; suggestedUrl?: string }> {
  const url = page.url();
  let domain = "";
  let linksHint = "";
  try { domain = new URL(url).hostname; } catch {}
  try {
    const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).slice(0, 20).map(a => `${a.textContent.trim().slice(0,20)}->${a.getAttribute("href")}`).join(", ")) as string;
    linksHint = links.slice(0, 400);
  } catch {}
  const intent = await parseChatIntent(input, domain, linksHint);
  const word = intent.target;
  const wantsPage = /\bpage\b/i.test(input);
  logger.info({ event: "agent_chat_intent", raw: intent.raw, target: word, via: process.env.OPENROUTER_API_KEY ? "openrouter" : "heuristic", wantsPage, domain });

  // For "pricing page" intent, prioritize footer/nav link click → navigate to actual /pricing page
  const shouldPrioritizeNav = wantsPage || intent.wantsNavigate || /\bpage\b/i.test(input);
  const findLink = async () => page.evaluate((w) => {
    const lower = w.toLowerCase().trim().split(/\s+/)[0];
    // Check nav bar and footer first, then all links — domain-specific page nav lives there
    const navFooterLinks = Array.from(document.querySelectorAll("nav a[href], header a[href], footer a[href]")) as HTMLAnchorElement[];
    const allLinks = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
    const exactNav = navFooterLinks.find((a) => a.textContent.trim().toLowerCase() === lower);
    if (exactNav) return { href: exactNav.getAttribute("href") || "", abs: new URL(exactNav.getAttribute("href") || "", location.href).href, text: exactNav.textContent.trim().slice(0, 40), source: "nav-footer" };
    const hrefNav = navFooterLinks.find((a) => (a.getAttribute("href") || "").toLowerCase().includes(lower));
    if (hrefNav) return { href: hrefNav.getAttribute("href") || "", abs: new URL(hrefNav.getAttribute("href") || "", location.href).href, text: hrefNav.textContent.trim().slice(0, 40), source: "nav-footer" };
    const exact = allLinks.find((a) => a.textContent.trim().toLowerCase() === lower);
    const hrefMatch = allLinks.find((a) => (a.getAttribute("href") || "").toLowerCase().includes(lower));
    const link = exact || hrefMatch;
    if (!link) return null;
    return { href: link.getAttribute("href") || "", abs: new URL(link.getAttribute("href") || "", location.href).href, text: link.textContent.trim().slice(0, 40), source: "all" };
  }, word).catch(() => null) as Promise<{ href: string; abs: string; text: string; source?: string } | null>;

  if (shouldPrioritizeNav) {
    const linkInfoEarly = await findLink();
    if (linkInfoEarly && linkInfoEarly.abs) {
      const current = page.url();
      if (linkInfoEarly.abs !== current) {
        let clicked = false;
        try {
          clicked = await page.evaluate((w) => {
            const lower = w.toLowerCase().trim().split(/\s+/)[0];
            const navFooter = Array.from(document.querySelectorAll("nav a[href], header a[href], footer a[href]")) as HTMLAnchorElement[];
            const all = Array.from(document.querySelectorAll("a[href]")) as HTMLAnchorElement[];
            const find = (arr: HTMLAnchorElement[]) => arr.find(a => a.textContent.trim().toLowerCase()===lower) || arr.find(a => (a.getAttribute("href")||"").toLowerCase().includes(lower));
            const link = find(navFooter) || find(all);
            if (link) { link.scrollIntoView({ block: "center" }); (link as HTMLElement).click(); return true; }
            return false;
          }, word);
          if (clicked) {
            await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 5000 }).catch(() => new Promise(r=>setTimeout(r,800)));
            logger.info({ event: "agent_chat_clicked_nav_footer", from: current, to: page.url(), word });
            return { selector: null, navigated: true, suggestedUrl: page.url() };
          }
        } catch {}
        try {
          await page.goto(linkInfoEarly.abs, { waitUntil: "domcontentloaded", timeout: 10000 });
          await new Promise((r) => setTimeout(r, 600));
          logger.info({ event: "agent_chat_navigated_early", from: current, to: linkInfoEarly.abs });
          return { selector: null, navigated: true, suggestedUrl: linkInfoEarly.abs };
        } catch (e) {
          logger.warn({ event: "agent_chat_navigate_failed", error: e instanceof Error ? e.message : String(e) });
        }
      }
      return { selector: null, navigated: false, suggestedUrl: linkInfoEarly.abs };
    }
    if (domain) {
      const fallbackUrl = `https://${domain}/${word}`;
      try {
        const current = page.url();
        if (fallbackUrl !== current) {
          await page.goto(fallbackUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
          await new Promise((r) => setTimeout(r, 800));
          logger.info({ event: "agent_chat_fallback_nav", to: fallbackUrl });
          return { selector: null, navigated: true, suggestedUrl: fallbackUrl };
        }
      } catch {}
    }
  }

  // 1) Try to find pricing section on current page via snapshot-like search (skip if wantsPage)
  if (!wantsPage) {
    const foundSelector = await page.evaluate((w) => {
      const lower = w.toLowerCase();
      const byId = document.querySelector(`#${CSS.escape(lower)}`);
      if (byId) return `#${CSS.escape(lower)}`;
      const byClass = document.querySelector(`.${CSS.escape(lower)}`);
      if (byClass) return `.${CSS.escape(lower)}`;
      const byAttr = document.querySelector(`[id*="${lower}" i], [class*="${lower}" i]`);
      if (byAttr) {
        if ((byAttr as HTMLElement).id) return `#${(byAttr as HTMLElement).id}`;
        const cls = (byAttr as HTMLElement).className.split(/\s+/)[0];
        if (cls) return `.${cls}`;
      }
      return null;
    }, word).catch(() => null);
    if (foundSelector) return { selector: foundSelector as string, navigated: false };
  }

  // 2) Check if it's a nav link to subpage (openrouter.ai case) — auto-navigate like chat would
  const linkInfo = await findLink();

  if (linkInfo && linkInfo.abs) {
    try {
      const current = page.url();
      if (linkInfo.abs !== current) {
        await page.goto(linkInfo.abs, { waitUntil: "networkidle2", timeout: 12000 });
        await new Promise((r) => setTimeout(r, 1000));
        logger.info({ event: "agent_chat_navigated", from: current, to: linkInfo.abs });
        return { selector: null, navigated: true, suggestedUrl: linkInfo.abs };
      }
    } catch (e) {
      logger.warn({ event: "agent_chat_navigate_failed", error: e instanceof Error ? e.message : String(e) });
    }
    return { selector: null, navigated: false, suggestedUrl: linkInfo.abs };
  }

  // 3) Fallback: treat raw input as selector
  return { selector: null, navigated: false };
}
