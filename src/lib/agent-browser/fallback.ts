import type { ScreenshotOptions } from "@/lib/schema";
import { RenderError, type RenderResult } from "@/lib/screenshot/types";
import {
  closeAgentBrowserSession,
  runAgentBrowser,
  runAgentBrowserData,
} from "@/lib/agent-browser/client";
import { RENDER_LIMITS } from "@/lib/security/limits";
import { logger } from "@/lib/logger";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Robust agent-browser FALLBACK engine.
 *
 * Runs the full Agent Core universe against an isolated agent-browser session
 * when the primary Puppeteer pipeline fails. Everything maps 1:1 to agent-browser
 * CLI commands:
 *
 *   open <url>                    --open / launch
 *   set viewport / set device     --viewport / device emulation
 *   set geo / set headers / cookies / set credentials / set media
 *   wait --text / --selector / --url / --fn   (readiness)
 *   scroll down + wait networkidle            (full-page lazy)
 *   screenshot [--full] / pdf / html
 *
 * Returns the same RenderResult the Puppeteer path returns, so the rest of the
 * API/job/storage pipeline is untouched.
 */

function makeSessionId(): string {
  const cfg = process.env.AGENT_BROWSER_SESSION_PREFIX || "screenshot-fallback";
  return `${cfg}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

/** Serialize options into a stable cache key (already exposed to result cache). */
function optionsFingerprint(options: ScreenshotOptions): string {
  return createHash("sha1").update(JSON.stringify(options)).digest("hex").slice(0, 10);
}

/**
 * Capture a full-page screenshot via agent-browser by scrolling through the
 * page and stitching, mirroring the Puppeteer stitched capture. Uses the CLI
 * primitive: `scroll down` + `screenshot` per viewport.
 */
async function captureFullPageScreenshots(
  session: string,
  opts: { viewport_height: number; format: string; quality: number; outDir: string }
): Promise<Buffer> {
  const viewportH = Math.max(opts.viewport_height, 1);
  const tiles: Buffer[] = [];
  const maxShots = 120;

  let previousTop = -1;

  // Read total scroll height once.
  const totalHeight = await runAgentBrowserData<number>(
    ["eval", "document.scrollingElement?.scrollHeight || document.documentElement.scrollHeight"],
    { session, timeoutMs: 8000 }
  ).catch(() => 0);

  for (let i = 0; i < maxShots; i++) {
    const top = Math.min(i * viewportH, (totalHeight || viewportH) - viewportH);
    if (Math.floor(top) === Math.floor(previousTop)) break;
    previousTop = top;

    await runAgentBrowser(["eval", `window.scrollTo(0, ${Math.floor(top)})`], {
      session,
      timeoutMs: 8000,
    }).catch(() => {});

    const jsonRes = await runAgentBrowser(
      ["screenshot", "--json"],
      { session, json: true, timeoutMs: 20_000 }
    ).catch(() => null);

    // Read the written file path from JSON when possible.
    const shotPath = extractScreenshotPath(jsonRes?.stdout || "");
    if (!shotPath) break;
    const { readFile } = await import("node:fs/promises");
    const buf = await readFile(shotPath).catch(() => null);
    if (buf) tiles.push(buf);
    await sleep(120);
  }

  await closeAgentBrowserSession(session);

  if (tiles.length === 0) throw new RenderError("NAVIGATION_FAILED", "agent-browser produced no frames");

  // Stitch via sharp (same as Puppeteer full-page path).
  const sharp = (await import("sharp")).default;
  const meta = await sharp(tiles[0]).metadata();
  const tileWidth = meta.width ?? 1280;
  const stitchedHeight = tiles.length * viewportH;

  const composed = await sharp({
    create: {
      width: tileWidth,
      height: Math.max(1, Math.round(stitchedHeight)),
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(
      tiles.map((t, idx) => ({
        input: t,
        top: Math.min(idx * viewportH, Math.round(stitchedHeight) - 1),
        left: 0,
      }))
    )
    .png()
    .toBuffer();

  return opts.format === "jpeg"
    ? Buffer.from(await sharp(composed).jpeg({ quality: opts.quality }).toBuffer())
    : composed;
}

function extractScreenshotPath(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout);
    const path =
      (parsed as { data?: { path?: string } | string }).data &&
      typeof (parsed as { data: unknown }).data === "object"
        ? ((parsed as { data: { path?: string } }).data?.path)
        : ((parsed as { data?: string }).data);
    if (path && path !== "agent-browser") return path;
  } catch {
    /* fall through to regex */
  }
  const m = stdout.match(/(?:Saved to|screenshot:)(\s+)([^\n]+\.(?:png|jpe?g|webp))/i);
  if (m && m[2]) return m[2].trim();
  return null;
}

/** Capture a viewport screenshot via agent-browser, returning a Buffer. */
async function captureViewportScreenshot(session: string): Promise<Buffer> {
  const jsonRes = await runAgentBrowser(
    ["screenshot", "--json"],
    { session, json: true, timeoutMs: 25_000 }
  );
  const path = extractScreenshotPath(jsonRes.stdout || "");
  if (!path) throw new RenderError("NAVIGATION_FAILED", "agent-browser produced no screenshot path");
  const { readFile } = await import("node:fs/promises");
  return readFile(path);
}

/** Prepare an isolated agent-browser session for the given URL/options. */
async function prepareSessionForUrl(
  session: string,
  options: ScreenshotOptions
): Promise<void> {
  if (!options.url) throw new RenderError("INVALID_URL", "agent-browser fallback requires url");

  // Session-scoped open (launch + navigate). Pass launch-level options that
  // can only be set at open (user-agent, dark mode) as extra args.
  const openArgs = ["open", options.url];
  if (options.user_agent) openArgs.push("--user-agent", options.user_agent);
  if (options.dark_mode) openArgs.push("--color-scheme", "dark");
  await runAgentBrowser(openArgs, { session, timeoutMs: Math.min(options.timeout, 35_000) });

  // Viewport / device emulation.
  if (options.device_scale_factor || options.is_mobile || options.has_touch) {
    const w = options.viewport_width ?? 1280;
    const h = options.viewport_height ?? 720;
    const scale = options.device_scale_factor ?? (options.is_mobile ? 2 : 1);
    await runAgentBrowser(["set", "viewport", String(w), String(h), String(scale)], { session }).catch(() => {});
  } else if (options.viewport_width || options.viewport_height) {
    await runAgentBrowser(
      ["set", "viewport", String(options.viewport_width ?? 1280), String(options.viewport_height ?? 720)],
      { session }
    ).catch(() => {});
  }

  // Geo (set geo <lat> <lng>).
  if (options.country) {
    const geo = COUNTRY_GEO[options.country.toUpperCase()];
    if (geo) {
      await runAgentBrowser(["set", "geo", String(geo.lat), String(geo.lng)], { session }).catch(() => {});
    }
  }

  // Cookies.
  if (options.cookies?.length && options.url) {
    for (const c of options.cookies) {
      await runAgentBrowser(["cookies", "set", c.name, c.value], { session }).catch(() => {});
    }
  }

  // Custom headers.
  if (options.headers && Object.keys(options.headers).length > 0) {
    await runAgentBrowser(["set", "headers", JSON.stringify(options.headers)], { session }).catch(() => {});
  }

  // HTTP basic auth.
  if (options.auth_username !== undefined || options.auth_password !== undefined) {
    await runAgentBrowser(
      ["set", "credentials", options.auth_username ?? "", options.auth_password ?? ""],
      { session }
    ).catch(() => {});
  }
}

const COUNTRY_GEO: Record<string, { lat: number; lng: number }> = {
  US: { lat: 37.7749, lng: -122.4194 }, GB: { lat: 51.5074, lng: -0.1278 }, DE: { lat: 52.52, lng: 13.405 }, JP: { lat: 35.6762, lng: 139.6503 },
  FR: { lat: 48.8566, lng: 2.3522 }, IN: { lat: 28.6139, lng: 77.209 }, BR: { lat: -23.5505, lng: -46.6333 }, CA: { lat: 43.6532, lng: -79.3832 },
  AU: { lat: -33.8688, lng: 151.2093 }, ES: { lat: 40.4168, lng: -3.7038 }, IT: { lat: 41.9028, lng: 12.4964 }, NL: { lat: 52.3676, lng: 4.9041 },
  PL: { lat: 52.2297, lng: 21.0122 }, SE: { lat: 59.3293, lng: 18.0686 }, AE: { lat: 25.2048, lng: 55.2708 }, SG: { lat: 1.3521, lng: 103.8198 },
  CH: { lat: 46.948, lng: 7.4474 }, MX: { lat: 19.4326, lng: -99.1332 }, KR: { lat: 37.5665, lng: 126.978 }, ID: { lat: -6.2088, lng: 106.8456 },
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Apply agent-browser readiness waits (mirrors applyReadiness custom mode). */
async function applyReadinessAgent(
  session: string,
  options: ScreenshotOptions,
  timeoutMs: number
): Promise<void> {
  if (options.wait_for_selector) {
    await runAgentBrowser(["wait", options.wait_for_selector], { session, timeoutMs }).catch(() => {});
  }
  if (options.wait_for_text) {
    await runAgentBrowser(["wait", "--text", options.wait_for_text], { session, timeoutMs }).catch(() => {});
  }
  if (options.wait_for_url) {
    await runAgentBrowser(["wait", "--url", options.wait_for_url], { session, timeoutMs }).catch(() => {});
  }
  if (options.wait_for_condition) {
    await runAgentBrowser(["wait", "--fn", options.wait_for_condition], { session, timeoutMs }).catch(() => {});
  }
  if (options.delay > 0) {
    await sleep(Math.min(options.delay, 1000));
  }
  // Wait network idle for complete readiness.
  const mode = options.readiness;
  if (mode === "complete" || options.wait_until === "networkidle2" || options.wait_until === "networkidle0") {
    await runAgentBrowser(["wait", "--load", "networkidle"], { session, timeoutMs: 15_000 }).catch(() => {});
  }
}

/**
 * Run the full Agent Core fallback render for a URL. Returns a RenderResult
 * identical in shape to the Puppeteer path. Only supports `png`/`jpeg`/`webp`
 * and `full_page` combinations; `pdf`/`html` fall back to the base runner.
 */
export async function renderViaAgentBrowser(
  options: ScreenshotOptions
): Promise<RenderResult> {
  if (!options.url) {
    throw new RenderError("INVALID_URL", "agent-browser fallback requires a url");
  }

  const session = makeSessionId();
  const fingerprint = optionsFingerprint(options);
  const outDir = mkdtempSync(join(tmpdir(), `agent-browser-${fingerprint}-`));

  logger.info({ event: "agent_browser_fallback_start", session, url: options.url });

  try {
    await prepareSessionForUrl(session, options);

    const readinessTimeout = Math.min(options.timeout ?? 10_000, RENDER_LIMITS.maxNavigationTimeMs);
    await applyReadinessAgent(session, options, readinessTimeout);

    // ── Format dispatch ────────────────────────────────────────────────
    if (options.format === "pdf") {
      const path = join(outDir, "out.pdf");
      await runAgentBrowser(["pdf", path], { session, timeoutMs: 35_000 });
      const { readFile } = await import("node:fs/promises");
      const buf = await readFile(path);
      return { buffer: buf, format: "pdf", width: 0, height: 0 };
    }

    if (options.format === "html") {
      const html = await runAgentBrowserData<string>(["get", "html", "html"], {
        session,
        timeoutMs: 20_000,
      }).catch(() => null);
      const body = html ?? "";
      return {
        buffer: Buffer.from(body, "utf-8"),
        format: "html",
        width: options.viewport_width ?? 1280,
        height: options.viewport_height ?? 720,
      };
    }

    if (options.format === "webp" || options.format === "jpeg" || options.format === "png") {
      let buffer: Buffer;
      if (options.full_page) {
        buffer = await captureFullPageScreenshots(session, {
          viewport_height: options.viewport_height ?? 720,
          format: options.format,
          quality: options.quality ?? 80,
          outDir,
        });
      } else {
        buffer = await captureViewportScreenshot(session);
      }

      // We already closed the session in full-page; only close for viewport path.
      await closeAgentBrowserSession(session);

      if (options.format === "webp") {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(buffer).metadata();
        const conv = await sharp(buffer).webp({ quality: options.quality ?? 80 }).toBuffer();
        return { buffer: conv, format: "webp", width: meta.width ?? options.viewport_width ?? 1280, height: meta.height ?? options.viewport_height ?? 720 };
      }

      let width = options.viewport_width ?? 1280;
      let height = options.viewport_height ?? 720;
      try {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(buffer).metadata();
        if (meta.width) width = meta.width;
        if (meta.height) height = meta.height;
      } catch {}
      return { buffer, format: options.format, width, height };
    }

    // Other formats unsupported via fallback — raise so caller keeps trying.
    throw new RenderError(
      "NAVIGATION_FAILED",
      `agent-browser fallback does not support format "${options.format}"`
    );
  } catch (err) {
    await closeAgentBrowserSession(session).catch(() => {});
    if (err instanceof RenderError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new RenderError("AGENT_BROWSER_FAILED", `agent-browser fallback failed: ${msg}`);
  } finally {
    const { rm } = await import("node:fs/promises").catch(() => ({ rm: null }));
    try {
      if (rm) await rm(outDir, { recursive: true, force: true });
    } catch {}
  }
}
