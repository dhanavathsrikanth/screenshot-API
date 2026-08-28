"use client";

import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { useEffect } from "react";

export function PostHogPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !posthog.__loaded) return;
    posthog.capture("$pageview", { pathname });
  }, [pathname]);

  return null;
}
