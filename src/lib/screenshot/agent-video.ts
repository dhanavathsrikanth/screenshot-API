import type { Page } from "puppeteer";
import type { ScreenshotOptions } from "@/lib/schema";
import type { RenderResult } from "@/lib/screenshot/types";
import { captureVideo as captureVideoCDP } from "@/lib/screenshot/video";
import { logger } from "@/lib/logger";

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
  // Check for Rust binary in prod Docker; dev Win falls back to CDP
  try {
    const { existsSync } = require("node:fs");
    return existsSync("/usr/local/bin/agent-browser") || existsSync("/usr/bin/agent-browser");
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
    const { spawn } = await import("child_process");
    const url = page.url();
    const tmp = `/tmp/agent-record-${Date.now()}.${options.format === "webm" ? "webm" : "mp4"}`;
    logger.info({ event: "agent_video_record_start", url, tmp });
    // Start: agent-browser --session <id> open <url> + record start
    // We already have a Puppeteer page, so we reuse its URL and let agent-browser
    // open the same URL in its own isolated session for recording.
    const session = `vid-${Date.now()}`;
    const start = spawn("agent-browser", ["--session", session, "open", url], { stdio: "pipe" });
    await new Promise<void>((res, rej) => {
      start.on("close", (c) => (c === 0 ? res() : rej(new Error(`open ${c}`))));
      setTimeout(() => res(), 4000);
    });
    const recStart = spawn("agent-browser", ["--session", session, "record", "start", tmp]);
    await new Promise<void>((r) => setTimeout(r, (options.video_seconds ?? 5) * 1000));
    const recStop = spawn("agent-browser", ["--session", session, "record", "stop"]);
    await new Promise<void>((res) => recStop.on("close", () => res()));
    const { readFile } = await import("fs/promises");
    const buf = await readFile(tmp).catch(() => null);
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
