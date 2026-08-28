"use client";

import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";

const EXACT_PAGES: Record<string, { event: string; slug?: undefined }> = {
  "/": { event: "landing_view" },
  "/pricing": { event: "pricing_viewed" },
  "/docs": { event: "docs_viewed" },
  "/tools": { event: "free_tools_viewed" },
  "/sign-up": { event: "signup_page_viewed" },
};

function resolveFunnelEvent(pathname: string): { event: string; properties?: Record<string, unknown> } | null {
  const exact = EXACT_PAGES[pathname];
  if (exact) return { event: exact.event };

  if (pathname.startsWith("/screenshot-api/")) {
    const slug = pathname.split("/")[2];
    if (slug) return { event: "guide_viewed", properties: { slug } };
  }
  if (pathname.startsWith("/vs/")) {
    const slug = pathname.split("/")[2];
    if (slug) return { event: "comparison_viewed", properties: { competitor: slug } };
  }
  return null;
}

/**
 * Fires the conversion-funnel pageview events once per route.
 * Deliberately separate from `$pageview` so the raw navigation stream and the
 * named funnel events can be queried independently.
 */
export function PostHogFunnelEvents() {
  const pathname = usePathname();
  const lastFired = useRef<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !posthog.__loaded) return;
    const match = resolveFunnelEvent(pathname);
    if (!match) return;
    if (lastFired.current === pathname) return;
    lastFired.current = pathname;
    posthog.capture(match.event, { pathname, ...match.properties });
  }, [pathname]);

  return null;
}
