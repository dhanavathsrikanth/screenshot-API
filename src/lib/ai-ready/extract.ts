import { Page } from "puppeteer";
import type {
  AccessibilityNode,
  HeadingGroup,
  ImageArtifact,
  LinkArtifact,
  NetworkRequestArtifact,
  PageMetadata,
  PerformanceArtifact,
} from "@/lib/ai-ready/types";

/**
 * Page extraction engine (blueprint §13–§20, §36).
 *
 * These run inside the browser page after readiness and produce the
 * AI-ready bundle. They are deliberately cheap and deterministic — an AI
 * model can consume the structured output without re-rendering the page.
 */

export async function extractMetadata(page: Page): Promise<PageMetadata> {
  return page.evaluate(() => {
    const meta = (name: string, property?: string): string | null => {
      const byName = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      const byProperty = property
        ? document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
        : null;
      return (byProperty?.content ?? byName?.content ?? null)?.trim() || null;
    };
    const link = (rel: string): string | null =>
      document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)?.href?.trim() || null;

    const ogImage = meta("og:image", "og:image");
    return {
      title: document.title?.trim() || null,
      description: meta("description"),
      canonical: link("canonical"),
      language: document.documentElement?.lang || null,
      robots: meta("robots"),
      ogTitle: meta("og:title", "og:title"),
      ogDescription: meta("og:description", "og:description"),
      ogImage,
      favicon: link("icon") ?? link("shortcut icon"),
    };
  });
}

/** Clean visible text: removes scripts/styles and hidden/offscreen elements. */
export async function extractVisibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    const blocks: string[] = [];
    const node = walker.currentNode;
    const root = node as Element;

    const collect = (el: Element): void => {
      const tag = el.tagName?.toLowerCase();
      if (["script", "style", "noscript", "template", "iframe", "svg", "canvas"].includes(tag)) return;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return;
      const rect = (el as HTMLElement).getBoundingClientRect?.();
      if (rect && rect.width === 0 && rect.height === 0 && tag !== "br") return;

      const children = Array.from(el.children);
      if (children.length === 0) {
        const text = el.textContent?.replace(/\s+/g, " ").trim();
        if (text) blocks.push(text);
      } else {
        children.forEach((c) => collect(c as Element));
      }
    };

    collect(root);
    return blocks.join("\n");
  });
}

export async function extractHeadings(page: Page): Promise<HeadingGroup> {
  return page.evaluate(() => {
    const result: HeadingGroup = { h1: [], h2: [], h3: [], h4: [] };
    for (const tag of ["h1", "h2", "h3", "h4"] as const) {
      document.querySelectorAll(tag).forEach((el) => {
        const text = el.textContent?.replace(/\s+/g, " ").trim();
        if (text) result[tag].push(text);
      });
    }
    return result;
  });
}

export async function extractLinks(page: Page): Promise<LinkArtifact[]> {
  return page.evaluate(() => {
    const origin = location.origin;
    const links: LinkArtifact[] = [];
    document.querySelectorAll("a[href]").forEach((a) => {
      const text = a.textContent?.replace(/\s+/g, " ").trim() || "";
      const href = (a as HTMLAnchorElement).href;
      if (!href || href.startsWith("javascript:")) return;
      links.push({
        text,
        href,
        isInternal: href.startsWith(origin),
      });
    });
    return links.slice(0, 1000);
  });
}

export async function extractImages(page: Page): Promise<ImageArtifact[]> {
  return page.evaluate(() => {
    const images: ImageArtifact[] = [];
    document.querySelectorAll("img").forEach((img) => {
      const el = img as HTMLImageElement;
      images.push({
        src: el.currentSrc || el.src || "",
        alt: el.alt?.trim() || null,
        width: el.width || null,
        height: el.height || null,
        loading: el.loading || null,
      });
    });
    return images.slice(0, 500);
  });
}

/** Chrome accessibility tree snapshot (limited depth to stay cheap). */
export async function extractAccessibility(page: Page): Promise<AccessibilityNode | null> {
  try {
    const snapshot = await page.accessibility.snapshot();
    if (!snapshot) return null;

    const map = (node: Awaited<ReturnType<Page["accessibility"]["snapshot"]>>): AccessibilityNode => ({
      role: node?.role ?? null,
      name: node?.name ?? "",
      children: node?.children?.map((c) => map(c)),
    });

    return map(snapshot);
  } catch {
    return null;
  }
}

export async function extractPerformance(page: Page): Promise<PerformanceArtifact> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      | (PerformanceNavigationTiming & { transferSize?: number })
      | undefined;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const total = resources.reduce((acc, r) => acc + (r.transferSize || 0), 0);

    return {
      dnsMs: nav ? Math.round(nav.domainLookupEnd - nav.domainLookupStart) : 0,
      tcpMs: nav ? Math.round(nav.connectEnd - nav.connectStart) : 0,
      tlsMs: nav ? Math.round(nav.requestStart - nav.connectEnd) : 0,
      ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.fetchStart) : 0,
      loadMs: nav ? Math.round(nav.loadEventEnd - nav.fetchStart) : 0,
      resourceCount: resources.length,
      transferSize: total,
    };
  });
}

export async function extractNetworkRequests(page: Page): Promise<NetworkRequestArtifact[]> {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    return entries.slice(0, 500).map((e) => ({
      url: e.name,
      type: e.initiatorType,
      status: 0,
      durationMs: Math.round(e.duration),
      size: e.transferSize || 0,
    }));
  });
}
