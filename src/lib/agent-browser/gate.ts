import { renderViaAgentBrowser } from "@/lib/agent-browser/fallback";
import { loadAgentBrowserConfig } from "@/lib/agent-browser/config";
import type { ScreenshotOptions } from "@/lib/schema";
import type { RenderResult } from "@/lib/screenshot/types";
import { logger } from "@/lib/logger";

/**
 * Decision gate for whether to attempt an agent-browser fallback render.
 * Keeps the fallback strictly opt-in per-category so we never surprise
 * existing API behaviour.
 */

export interface AgentFallbackDecision {
  /** Whether the binary is installed and fallback is enabled. */
  usable: boolean;
  /** Human reason when unusable. */
  reason?: string;
}

export function isAgentBrowserUsable(): AgentFallbackDecision {
  const config = loadAgentBrowserConfig();
  if (!config.binaryPath) {
    return { usable: false, reason: "agent-browser binary not found" };
  }
  return { usable: true };
}

/**
 * Should we attempt a fallback for a given pipeline failure? Tuned so common
 * bot-block / navigation failures (the exact cases Puppeteer struggles with)
 * trigger a fallback, while validation and timeout errors stay as-is.
 */
export function shouldFallbackOnError(error: unknown, options: ScreenshotOptions): boolean {
  if (process.env.AGENT_BROWSER_DISABLED === "1") return false;
  const usable = isAgentBrowserUsable();
  if (!usable.usable) return false;

  // Only attempt for URL-based renders (agent-browser drives its own browser).
  if (!options.url) return false;

  const msg = error instanceof Error ? error.message : String(error);
  // Navigation/bot-block failures — best candidates.
  if (
    /blocks? automated browsers|bot|NAVIGATION_FAILED|NAVIGATION_TIMEOUT/i.test(msg)
  ) {
    return true;
  }
  // Crash-recovery failures (browser process died) — worth a retry elsewhere.
  if (
    /protocol error|target closed|connection closed|connection reset|session terminated|browser has been disconnected|execution context was destroyed/i.test(msg)
  ) {
    return true;
  }
  return false;
}

/**
 * Attempt an agent-browser fallback render for the given options, returning
 * null (without throwing) when the binary is unavailable so callers can keep
 * trying their own recovery.
 */
export async function tryAgentBrowserFallbackRender(
  options: ScreenshotOptions
): Promise<RenderResult | null> {
  const usable = isAgentBrowserUsable();
  if (!usable.usable) {
    logger.info({ event: "agent_browser_skipped", reason: usable.reason });
    return null;
  }
  try {
    const result = await renderViaAgentBrowser(options);
    logger.info({ event: "agent_browser_fallback_success", url: options.url, format: result.format });
    return result;
  } catch (err) {
    logger.warn({
      event: "agent_browser_fallback_error",
      url: options.url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
