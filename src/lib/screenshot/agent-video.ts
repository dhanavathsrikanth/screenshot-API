import type { Page } from "puppeteer";
import type { ScreenshotOptions } from "@/lib/schema";
import type { RenderResult } from "@/lib/screenshot/types";
import { captureVideo as captureVideoCDP } from "@/lib/screenshot/video";
import { logger } from "@/lib/logger";
import { loadAgentBrowserConfig } from "@/lib/agent-browser/config";
import { runAgentBrowser, closeAgentBrowserSession } from "@/lib/agent-browser/client";

/**
 * Agent-browser inspired video — mirrors:
 *   agent-browser record start <path>   # start WebM recording
 *   agent-browser record stop             # stop and save
 *   agent-browser trace/profiler (debug)
 *
 * In this service we keep the CDP+ffmpeg pipeline (video.ts) as primary
 * but expose it via `record start/stop` semantics for playground.
 * If `agent-browser` binary is available (Docker), we shell out to it;
 * otherwise we delegate to the existing CDP implementation.
 */

function isAgentBrowserAvailable(): boolean {
  // Use the shared binary discovery (works on dev Windows + prod Docker).
  try {
    return !!loadAgentBrowserConfig().binaryPath;
  } catch {
    return false;
  }
}

async function captureViaAgentBrowserRecord(
  page: Page,
  options: ScreenshotOptions
): Promise<RenderResult | null> {
  if (!isAgentBrowserAvailable()) return null;
  try {
    const url = page.url();
    const tmp = `${process.env.TEMP || "/tmp"}/agent-record-${Date.now()}.${options.format === "webm" ? "webm" : "mp4"}`;
    logger.info({ event: "agent_video_record_start", url, tmp });
    // Reuse the URL and let agent-browser open the same URL in its own
    // isolated session for recording (agent-browser record start/stop).
    const session = `vid-${Date.now().toString(36)}`;
    await runAgentBrowser(["open", url], { session, timeoutMs: 20_000 }).catch(() => {});
    await runAgentBrowser(["record", "start", tmp], { session, timeoutMs: 15_000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, (options.video_seconds ?? 5) * 1000));
    await runAgentBrowser(["record", "stop"], { session, timeoutMs: 15_000 }).catch(() => {});
    const { readFile } = await import("fs/promises");
    const buf = await readFile(tmp).catch(() => null);
    await closeAgentBrowserSession(session).catch(() => {});
    if (buf) return { buffer: buf, format: options.format, width: options.viewport_width, height: options.viewport_height };
    return null;
  } catch (e) {
    logger.warn({ event: "agent_video_record_failed", error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/**
 * Public video entry — tries agent-browser `record` first, falls back to CDP.
 * Mirrors `captureVideo()` but with `record start/stop` naming.
 */
export async function captureVideoAgent(page: Page, options: ScreenshotOptions): Promise<RenderResult> {
  logger.info({ event: "agent_video_start", format: options.format, seconds: options.video_seconds, speed: options.video_speed });
  const viaAgent = await captureViaAgentBrowserRecord(page, options).catch(() => null);
  if (viaAgent) {
    logger.info({ event: "agent_video_via_record" });
    return viaAgent;
  }
  // Fallback: existing CDP+ffmpeg pipeline (keeps setpts speed handling)
  return captureVideoCDP(page, options);
}
