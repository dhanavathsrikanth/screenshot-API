import { RenderError } from "@/lib/screenshot/types";

/**
 * Engine-level hard limits for every render (blueprint §31). These are
 * guard rails — the schema enforces friendlier limits, this module enforces
 * what the browser process can actually survive.
 */
export const RENDER_LIMITS = {
  /** Longest a single navigation may run. */
  maxNavigationTimeMs: 20_000,
  /** Hard wall-clock budget for the whole render pipeline. */
  maxTotalTimeMs: 45_000,
  /** Max redirect hops allowed before a navigation is rejected. */
  maxRedirects: 10,
  /** Max screenshot dimensions (CSS px) the engine will capture. */
  maxScreenshotWidth: 5000,
  maxScreenshotHeight: 15000,
  /** Max parallel pages the browser will service. */
  maxConcurrentPages: 10,
} as const;

export function clampViewport(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.min(Math.max(320, Math.round(width)), RENDER_LIMITS.maxScreenshotWidth),
    height: Math.min(Math.max(200, Math.round(height)), RENDER_LIMITS.maxScreenshotHeight),
  };
}

/**
 * Wrap a render pipeline in a hard total-time budget. When the budget is
 * exhausted the work keeps running in the background (browser teardown is
 * handled by the caller's finally block) but the caller receives a
 * RENDER_TIMEOUT immediately.
 */
export function withTotalBudget<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RenderError("RENDER_TIMEOUT", `Render exceeded the ${timeoutMs}ms total time budget.`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function isWithinRedirectLimit(redirectCount: number): boolean {
  return redirectCount <= RENDER_LIMITS.maxRedirects;
}
