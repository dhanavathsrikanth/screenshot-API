// @ts-nocheck - temporary until captureVideo scoping refactor is landed (cleanAbort/scrollAbort)
// eslint-disable-next-line
import { type Page } from "puppeteer";
import { spawn, type ChildProcess } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { ScreenshotOptions } from "@/lib/schema";
import type { RenderResult } from "@/lib/screenshot/types";
import { RenderError } from "@/lib/screenshot/types";
import { overlaySelectorsFor } from "@/lib/screenshot/clean-presets";

/**
 * Resolve the path to the ffmpeg binary bundled by ffmpeg-static.
 * Returns null when the package isn't installed.
 * Robust for Vercel NFT / bundled environments where __dirname shifts and
 * the traced binary may not be at the `require('ffmpeg-static')` path.
 * Falls back to system `ffmpeg` in PATH.
 */
function resolveFfmpegPath(): string | null {
  const { existsSync } = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const os = require("node:os") as typeof import("node:os");

  const candidates: (string | null | undefined)[] = [];

  // 1. Env var override (ffmpeg-static convention)
  if (process.env.FFMPEG_BIN) candidates.push(process.env.FFMPEG_BIN);

  // 2. Direct require('ffmpeg-static') — the package's index.js uses __dirname
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const p = require("ffmpeg-static") as string | null;
    candidates.push(p);
  } catch {}

  // 3. CWD-based lookups (covers Vercel standalone where __dirname is .next/server)
  const exe = os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const cwd = process.cwd();
  candidates.push(path.join(cwd, "node_modules", "ffmpeg-static", exe));
  candidates.push(path.join(cwd, "node_modules", "ffmpeg-static", "ffmpeg"));
  // Vercel may hoist under .next
  candidates.push(path.join(cwd, ".next", "node_modules", "ffmpeg-static", exe));
  // One level up (when running from .next/server)
  candidates.push(path.join(cwd, "..", "node_modules", "ffmpeg-static", exe));
  candidates.push(path.join(__dirname, "..", "..", "..", "node_modules", "ffmpeg-static", exe));
  candidates.push(path.join(__dirname, "ffmpeg"));
  candidates.push(path.join(__dirname, "ffmpeg.exe"));

  for (const cand of candidates) {
    if (!cand) continue;
    // Handle \ROOT\... oddity seen in bundled env where drive letter is stripped —
    // try with and without drive prefix via existence check
    const normalized = path.normalize(cand);
    if (existsSync(normalized)) return normalized;
    // Also try resolving relative to cwd if absolute \ROOT form
    if (normalized.startsWith(path.sep + "ROOT")) {
      const alt = path.join(cwd, normalized.slice(5)); // strip \ROOT
      if (existsSync(alt)) return alt;
    }
  }

  // 4. Last resort: assume `ffmpeg` is on PATH (e.g. Docker apt-get ffmpeg)
  // `spawn('ffmpeg', ...)` will succeed if system ffmpeg is installed.
  // We signal availability by returning 'ffmpeg' and letting the caller try.
  // Check quickly via which/where
  try {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const whichCmd = os.platform() === "win32" ? "where ffmpeg" : "which ffmpeg";
    execSync(whichCmd, { stdio: "ignore" });
    return "ffmpeg";
  } catch {}

  return null;
}

export function isVideoFormat(format: string, videoSeconds?: number): boolean {
  return format === "mp4" || format === "webm" || (format === "gif" && !!videoSeconds && videoSeconds > 0);
}

/**
 * Build ffmpeg CLI args for the requested output format.
 * When `outPath` is provided, writes to a file (needed for mp4/webm muxers
 * that require seekable output).  Otherwise pipes to stdout (gif).
 *
 * `speed` is the playback multiplier (1–4×): the source is recorded for
 * `duration × speed` wall-clock seconds, then `setpts = PTS/speed` compresses
 * the timeline back to `duration`, so more page motion fits into the clip.
 */
function ffmpegArgs(
  format: "mp4" | "webm" | "gif",
  fps: number,
  width: number,
  height: number,
  speed: number,
  outPath?: string
): string[] {
  const input = [
    "-f", "image2pipe", "-c:v", "mjpeg", "-pix_fmt", "yuvj420p",
    "-framerate", String(fps), "-i", "pipe:0",
  ];

  // Even dimensions for yuv420p (h264 requirement).
  const w = width % 2 === 0 ? width : width + 1;
  const h = height % 2 === 0 ? height : height + 1;
  const scale = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`;
  const spedUp = `setpts=PTS/${speed}`;
  const outFps = Math.min(60, Math.round(fps * speed));
  const out = outPath ?? "pipe:1";

  switch (format) {
    case "mp4":
      return [
        ...input,
        "-vf", `${scale},${spedUp},fps=${outFps}`,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-crf", "23", "-preset", "fast",
        "-movflags", "+faststart",
        "-f", "mp4", "-y", out,
      ];
    case "webm":
      return [
        ...input, "-vf", `${scale},${spedUp},fps=${outFps}`,
        "-c:v", "libvpx", "-crf", "12", "-b:v", "1M",
        "-deadline", "realtime",
        "-f", "webm", "-y", out,
      ];
    case "gif":
      // Use scale + palettegen; keep filter simple for ffmpeg-static compatibility.
      // Single-pass split palette is robust but older builds dislike stats_mode/bayer params,
      // so we use the widely-supported palettegen/paletteuse form.
      return [
        ...input,
        "-vf", `${scale},${spedUp},fps=${outFps},split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,
        "-loop", "0",
        "-f", "gif", "-y", out,
      ];
  }
}

/**
 * Capture a video / animated GIF of the current page state using CDP
 * screencast → ffmpeg-static encoding pipeline.
 *
 * `page` must already be fully prepared (navigation + readiness applied).
 */
export async function captureVideo(
  page: Page,
  options: ScreenshotOptions
): Promise<RenderResult> {
  const ffmpegPath = resolveFfmpegPath();
  if (!ffmpegPath) {
    // Permanent: retrying without the binary will never succeed.
    throw new RenderError(
      "ffmpeg_error",
      "Video capture is not available: ffmpeg binary not found. Install ffmpeg-static."
    );
  }

  const format = options.format as "mp4" | "webm" | "gif";
  const durationSec = Math.max(1, Math.min(options.video_seconds ?? 5, 30));
  const fps = Math.max(1, Math.min(options.video_fps ?? 5, 30));
  const speed = Math.max(1, Math.min(options.video_speed ?? 1, 4));
  const width = options.viewport_width ?? 1280;
  const height = options.viewport_height ?? 720;

  // Speed records for `duration × speed` wall-clock seconds; playback is then
  // re-timed to `duration` via setpts. Clamp the recording window so it stays
  // well inside the engine's total budget (120s for video: ~20s nav + encode
  // headroom). 75s was too tight after `preparePage` + fallback retry, so 60s
  // leaves ~40s for navigation/readiness + ffmpeg mux.
  const MAX_RECORD_SECONDS = 60;
  const recordSec = Math.min(durationSec * speed, MAX_RECORD_SECONDS);

  // mp4/webm muxers require seekable output — gif also benefits from file output
  // (avoids pipe:1 buffering races that surfaced as `exit null` on gif).
  const useFile = true;
  let tmpDir: string | null = null;
  let tmpFile: string | null = null;
  if (useFile) {
    tmpDir = await mkdtemp(join(tmpdir(), "vid-"));
    tmpFile = join(tmpDir, `out.${format}`);
  }

  let ffmpegProc: ChildProcess | null = null;
  let ffmpegFinished: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  let ffmpegStderr = "";
  let ffmpegStdoutForPipe = "";
  const stdoutChunks: Buffer[] = [];
  // Shared abort flags for concurrent tasks (visible in catch/finally)
  let cleanAbort = false;
  let scrollAbort = false;
  let stopped = false;
  let cleanTask: Promise<void> | null = null;
  let scrollTask: Promise<void> | null = null;
  let chatTask: Promise<void> | null = null;
  // Dialog handler ref for cleanup
  let dialogHandler: ((dialog: unknown) => Promise<void>) | null = null;

  try {
    // ── Spawn ffmpeg ──────────────────────────────────────────────────────
    const args = ffmpegArgs(format, fps, width, height, speed, tmpFile ?? undefined);
    ffmpegProc = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    ffmpegProc.stderr?.on("data", (chunk: Buffer) => { ffmpegStderr += chunk.toString(); });
    ffmpegProc.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      // Keep a small text preview for debug when gif uses pipe fallback
      ffmpegStdoutForPipe += chunk.toString("utf8").slice(0, 200);
    });
    ffmpegFinished = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
      ffmpegProc!.on("close", (code, signal) => resolve({ code, signal }));
      ffmpegProc!.on("error", (err) => {
        ffmpegStderr += ` spawn error: ${err instanceof Error ? err.message : String(err)}`;
        resolve({ code: null, signal: null });
      });
    });

    if (ffmpegProc.exitCode !== null) {
      throw new RenderError(
        "RENDER_TIMEOUT",
        `ffmpeg failed to start (exit ${ffmpegProc.exitCode}): ${ffmpegStderr.slice(0, 500)}`
      );
    }

    // ── Prepare selector / scroll position for video ──────────────────────
    // Video previously ignored `selector`, `chat_input` and `full_page`; ensure they work.
    // Promote any plain-English selector (e.g. "pricing", "footer") to AI chat so
    // "Capture a specific part" description is followed via agent-browser AI.
    let chatInput = (options as unknown as { chat_input?: string }).chat_input?.trim() || "";
    if (!chatInput && options.selector) {
      const sel = options.selector.trim();
      const isCssLike = /^[#.\[]/.test(sel) || sel.includes(">") || sel.includes("+") || sel.includes("~") || sel.includes(":") || sel.includes("[");
      const isPlain = !isCssLike && /^[a-zA-Z][\w\s-]*$/.test(sel) && sel.length >= 2;
      if (isPlain) chatInput = sel;
    }
    // For static selector (no chat) scroll target into view before recording.
    if (!chatInput && options.selector) {
      try {
        const selRaw = options.selector.trim().replace(/^["']|["']$/g, "");
        await page.evaluate((sel) => {
          let el: Element | null = null;
          try { el = document.querySelector(sel); } catch {}
          if (!el) {
            const lower = sel.toLowerCase();
            const word = sel.split(/\s+/)[0].replace(/"/g, "").replace(/[^a-zA-Z0-9_-]/g, "");
            if (word) {
              try { el = document.querySelector(`#${word}`); } catch {}
              if (!el) try { el = document.querySelector(`.${word}`); } catch {}
            }
            if (!el) {
              const all = Array.from(document.querySelectorAll("section, article, div, main, ul"));
              el = all.find((e) => (e.textContent || "").toLowerCase().includes(lower)) || null;
            }
            if (!el) {
              el = Array.from(document.querySelectorAll("*")).find((e) => (e.textContent || "").trim().toLowerCase().includes(lower)) || null;
            }
          }
          if (el) (el as HTMLElement).scrollIntoView({ block: "center", inline: "nearest" });
        }, selRaw).catch(() => {});
        await new Promise((r) => setTimeout(r, 350));
      } catch {}
    } else if (!chatInput && !options.full_page) {
      // Ensure we start at top for consistent viewport video (unless full_page or chat-driven)
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
      await new Promise((r) => setTimeout(r, 80));
    } else if (chatInput) {
      // For chat-driven video we stay at top initially; the click/navigation
      // will be performed *during* recording so it's captured in gif/mp4.
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
      await new Promise((r) => setTimeout(r, 80));
    }

    // ── CDP screencast ────────────────────────────────────────────────────
    const cdp = await page.createCDPSession();
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 85,
      maxWidth: width,
      maxHeight: height,
      everyNthFrame: 1,
    } as never);

    let frameCount = 0;
    const frameBuffers: Buffer[] = [];
    stopped = false;
    scrollAbort = false;

    const stopRecording = async (): Promise<void> => {
      if (stopped) return;
      stopped = true;
      try { await cdp.send("Page.stopScreencast"); } catch { /* page closed */ }
    };

    cdp.on("Page.screencastFrame", async (event: { data: string; sessionId: number }) => {
      if (stopped) {
        try { await cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }); } catch { /* noop */ }
        return;
      }

      const jpegBuf = Buffer.from(event.data, "base64");
      frameCount++;
      frameBuffers.push(jpegBuf);

      if (ffmpegProc && ffmpegProc.exitCode === null && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
        const ok = ffmpegProc.stdin.write(jpegBuf);
        if (!ok) {
          await new Promise<void>((r) => ffmpegProc!.stdin!.once("drain", r));
        }
      }

      try { await cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }); } catch { /* noop */ }
    });

    // ── Dialog auto-dismiss (alert/confirm) — must be before screencast ───
    dialogHandler = async (dialog: unknown) => {
      try { await (dialog as { dismiss: () => Promise<void> }).dismiss(); } catch {}
    };
    // Puppeteer Page has .on('dialog') — use any to avoid type strictness
    try { (page as unknown as { on: (e: string, h: (...a: unknown[]) => void) => void }).on("dialog", dialogHandler as unknown as (...a: unknown[]) => void); } catch {}

    // ── Continuous popup/dialog cleaning during recording ────────────────
    // Image path does one-time `dismissOverlaysWithSnapshot`; video records
    // 5-60s and popups that appear *during* recording would be captured.
    // Run a periodic hide so cookie banners / chat widgets / modals stay hidden.
    cleanAbort = false;
    const overlaySelectors = overlaySelectorsFor({
      preset: (options as unknown as { clean_preset?: string }).clean_preset as "default" | "strict" | "off" | undefined,
      blockCookieBanners: (options.block_cookie_banners ?? true) as boolean,
      blockChats: (options.block_chats ?? true) as boolean,
      hideSelectors: (options as unknown as { hide_selectors?: string }).hide_selectors ?? null,
    });
    cleanTask = (async () => {
      // Lazy import to avoid cycle
      const { dismissOverlaysWithSnapshot } = await import("@/lib/screenshot/agent-clean");
      while (!cleanAbort && !stopped) {
        try {
          if (overlaySelectors.length) {
            await page.evaluate((sels) => {
              for (const sel of sels) {
                try { document.querySelectorAll(sel).forEach((el) => (el as HTMLElement).style.setProperty("display", "none", "important")); } catch {}
              }
              // Also hide generic dialog/modal overlays that may appear mid-video
              const generics = document.querySelectorAll('[role="dialog"], [role="alertdialog"], .modal, .popup, .overlay, [class*="modal"], [class*="popup"]');
              for (const el of Array.from(generics)) {
                try {
                  const s = window.getComputedStyle(el as HTMLElement);
                  const r = (el as HTMLElement).getBoundingClientRect();
                  if ((s.position === "fixed" || s.position === "absolute") && (r.width > 280 || r.height > 160)) {
                    (el as HTMLElement).style.setProperty("display", "none", "important");
                  }
                } catch {}
              }
            }, overlaySelectors).catch(() => {});
          }
          await dismissOverlaysWithSnapshot(page).catch(() => {});
        } catch {}
        await new Promise((r) => setTimeout(r, 450));
      }
    })();

    // ── Full-page / scroll-animation + chat interaction during recording ─
    // For full_page video we scroll from top to bottom over the duration so
    // the output shows the whole page and triggers scroll-linked animations.
    // Chat-driven video ("click pricing", "open footer link") is executed
    // *during* recording so the click/navigation is visible in gif/mp4.
    scrollTask = null;
    chatTask = null;
    if (chatInput) {
      chatTask = (async () => {
        try {
          // Let initial viewport frames capture before interacting
          await new Promise((r) => setTimeout(r, 700));
          if (scrollAbort || stopped) return;
          const { handleChatSingleShot } = await import("@/lib/screenshot/agent-chat");
          const result = await handleChatSingleShot(page, chatInput).catch(() => ({ selector: null, navigated: false } as const));
          if (result && (result as { navigated?: boolean }).navigated) return;
          if (result && (result as { selector?: string | null }).selector) {
            const sel = (result as { selector: string }).selector;
            await page.evaluate((s) => { try { document.querySelector(s)?.scrollIntoView({ block: "center" }); } catch {} }, sel).catch(() => {});
            await new Promise((r) => setTimeout(r, 280));
            return;
          }
          // Generic fallback for any element: button, link, sidebar, nav, footer
          // Handles "click login button", "click footer pricing", "click sidebar docs"
          const filler = new Set(["click","tap","press","open","go","take","screenshot","video","gif","record","show","me","the","a","an","please","on","home","page","button","link","text","element","sidebar","nav","navbar","footer","menu","item"]);
          const words = chatInput.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean).filter((w) => !filler.has(w));
          const targetWord = words[0] || chatInput.split(/\s+/)[0] || "";
          if (!targetWord) return;
          const clicked = await page.evaluate((word) => {
            const lower = word.toLowerCase();
            // Prioritize nav/header/aside/sidebar/footer then all
            const scopeSelectors = ["nav a[href]", "header a[href]", "aside a[href]", "[role=\"navigation\"] a[href]", "footer a[href]", "button", "a[href]", "[role=\"button\"]", "[onclick]"];
            const allCandidates: Element[] = [];
            for (const sel of scopeSelectors) {
              try { allCandidates.push(...Array.from(document.querySelectorAll(sel))); } catch {}
            }
            // Also include any element with matching text
            const textMatches = Array.from(document.querySelectorAll("*")).filter((e) => {
              const t = (e.textContent || "").trim().toLowerCase();
              const aria = (e.getAttribute("aria-label") || "").toLowerCase();
              return t === lower || t.includes(lower) || aria.includes(lower);
            });
            allCandidates.push(...textMatches);
            const visible = allCandidates.filter((el) => {
              const r = (el as HTMLElement).getBoundingClientRect();
              const s = window.getComputedStyle(el as Element);
              if (r.width < 8 || r.height < 8) return false;
              if (s.visibility === "hidden" || s.display === "none" || s.opacity === "0") return false;
              return true;
            });
            // Prefer exact text match, then href includes, then any
            let el = visible.find((e) => (e.textContent || "").trim().toLowerCase() === lower) as HTMLElement | undefined;
            if (!el) el = visible.find((e) => (e.getAttribute("href") || "").toLowerCase().includes(lower)) as HTMLElement | undefined;
            if (!el) el = visible.find((e) => (e.textContent || "").toLowerCase().includes(lower)) as HTMLElement | undefined;
            if (!el) el = visible[0] as HTMLElement | undefined;
            if (!el) return false;
            try { (el as HTMLElement).scrollIntoView({ block: "center", inline: "nearest" }); } catch {}
            try { (el as HTMLElement).click(); } catch {
              try { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); } catch {}
            }
            return true;
          }, targetWord).catch(() => false);
          if (clicked) await new Promise((r) => setTimeout(r, 600));
        } catch {}
      })();
    }
    if (options.full_page && !options.selector && !chatInput) {
      scrollTask = (async () => {
        try {
          // Ensure start at top
          await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
          await new Promise((r) => setTimeout(r, 120));
          const metrics = await page.evaluate(() => ({
            scrollHeight: (document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight ?? 0) as number,
            clientHeight: (document.scrollingElement?.clientHeight ?? window.innerHeight ?? 0) as number,
          })).catch(() => ({ scrollHeight: 0, clientHeight: 0 }));
          const maxScroll = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
          if (maxScroll <= 0) return;
          const startAt = Date.now();
          while (!scrollAbort && !stopped) {
            const elapsed = (Date.now() - startAt) / 1000;
            if (elapsed >= recordSec) break;
            const progress = elapsed / recordSec;
            // Ease-in-out for smoother animation capture
            const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
            const y = Math.floor(maxScroll * eased);
            await page.evaluate((yy) => window.scrollTo(0, yy), y).catch(() => {});
            await new Promise((r) => setTimeout(r, 70));
          }
          if (!scrollAbort) {
            await page.evaluate((y) => window.scrollTo(0, y), maxScroll).catch(() => {});
            await new Promise((r) => setTimeout(r, 180));
          }
        } catch {}
      })();
    } else if (!options.reduced_motion && !options.selector && !chatInput) {
      // Non-fullpage video: nudge scroll slightly to trigger scroll-linked
      // animations (fade-in, parallax) without leaving the viewport.
      // This was missing, so scroll animations appeared frozen.
      scrollTask = (async () => {
        try {
          await new Promise((r) => setTimeout(r, 400));
          if (scrollAbort || stopped) return;
          const hasScroll = await page.evaluate(() => {
            const el = document.scrollingElement || document.documentElement;
            return (el.scrollHeight || 0) > (el.clientHeight || window.innerHeight) + 40;
          }).catch(() => false);
          if (!hasScroll) return;
          // Small scroll down/up to trigger IntersectionObserver animations
          await page.evaluate(() => window.scrollBy(0, 120)).catch(() => {});
          await new Promise((r) => setTimeout(r, 350));
          if (scrollAbort || stopped) return;
          await page.evaluate(() => window.scrollBy(0, -80)).catch(() => {});
          await new Promise((r) => setTimeout(r, 280));
          // For longer videos, also do a gentle mid-duration scroll
          if (recordSec > 6 && !scrollAbort && !stopped) {
            await new Promise((r) => setTimeout(r, 700));
            if (scrollAbort || stopped) return;
            await page.evaluate(() => window.scrollBy(0, 200)).catch(() => {});
            await new Promise((r) => setTimeout(r, 400));
          }
        } catch {}
      })();
    }

    // ── Record for duration ───────────────────────────────────────────────
    await new Promise((r) => setTimeout(r, recordSec * 1000));
    scrollAbort = true;
    cleanAbort = true;
    await stopRecording();
    await new Promise((r) => setTimeout(r, 50)); // flush in-flight frames
    if (scrollTask) await scrollTask.catch(() => {});
    if (chatTask) await chatTask.catch(() => {});
    if (cleanTask) await cleanTask.catch(() => {});
    // Remove dialog listener
    try { (page as unknown as { off: (e: string, h: (...a: unknown[]) => void) => void }).off("dialog", dialogHandler as unknown as (...a: unknown[]) => void); } catch {}
    // Reset scroll to top for clean teardown
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

    // ── Close ffmpeg stdin, wait for encoding ─────────────────────────────
    if (ffmpegProc && ffmpegProc.exitCode === null && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
      ffmpegProc.stdin.end();
    }

    // Guard against hung ffmpeg (e.g. palettegen deadlock) — don't let it
    // consume the whole 120s engine budget. 25s is plenty for 30s @5fps.
    const FFMPEG_TIMEOUT_MS = 25_000;
    let { code: exitCode, signal: exitSignal } = await Promise.race([
      ffmpegFinished,
      new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((_, reject) =>
        setTimeout(() => reject(new RenderError("ffmpeg_error", `ffmpeg timed out after ${FFMPEG_TIMEOUT_MS}ms: ${ffmpegStderr.slice(0,400)}`)), FFMPEG_TIMEOUT_MS)
      ),
    ]).catch((e) => {
      if (ffmpegProc && ffmpegProc.exitCode === null) {
        try { ffmpegProc.kill("SIGKILL"); } catch {}
      }
      throw e;
    });
    // ── GIF fallback: palettegen is fragile on some ffmpeg-static builds/frames.
    // If the first encode failed (exit null / non-zero), retry with a simple
    // scale+fps gif mux without palettegen, re-feeding the buffered JPEGs.
    if (exitCode !== 0 && format === "gif" && frameBuffers.length > 0) {
      const firstStderr = ffmpegStderr.slice(0, 600);
      // Kill the failed proc fully and try simple fallback
      try { if (ffmpegProc && ffmpegProc.exitCode === null) ffmpegProc.kill("SIGKILL"); } catch {}
      // Clean partial output
      if (tmpFile) { try { const { unlink } = await import("fs/promises"); await unlink(tmpFile).catch(()=>{}); } catch {} }
      // Spawn fallback ffmpeg with no palettegen: just scale+speed+fps -> gif
      const w2 = width % 2 === 0 ? width : width + 1;
      const h2 = height % 2 === 0 ? height : height + 1;
      const scale2 = `scale=${w2}:${h2}:force_original_aspect_ratio=decrease,pad=${w2}:${h2}:(ow-iw)/2:(oh-ih)/2`;
      const spedUp2 = `setpts=PTS/${speed}`;
      const outFps2 = Math.min(60, Math.round(fps * speed));
      const fallbackArgs = [
        "-f", "image2pipe", "-c:v", "mjpeg", "-pix_fmt", "yuvj420p",
        "-framerate", String(fps), "-i", "pipe:0",
        "-vf", `${scale2},${spedUp2},fps=${outFps2}`,
        "-loop", "0", "-f", "gif", "-y", tmpFile!,
      ];
      ffmpegStderr = "";
      const fbProc = spawn(ffmpegPath, fallbackArgs, { stdio: ["pipe", "pipe", "pipe"] });
      ffmpegProc = fbProc;
      fbProc.stderr?.on("data", (c: Buffer) => { ffmpegStderr += c.toString(); });
      const fbFinished = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((res) => {
        fbProc.on("close", (c, s) => res({ code: c, signal: s }));
        fbProc.on("error", (e) => { ffmpegStderr += ` spawn error: ${e instanceof Error ? e.message : String(e)}`; res({ code: null, signal: null }); });
      });
      // Feed buffered frames
      for (const buf of frameBuffers) {
        if (fbProc.stdin && !fbProc.stdin.destroyed) {
          const ok = fbProc.stdin.write(buf);
          if (!ok) await new Promise<void>((r) => fbProc.stdin!.once("drain", r));
        }
      }
      fbProc.stdin?.end();
      const fbRes = await Promise.race([
        fbFinished,
        new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((_, reject) =>
          setTimeout(() => {
            try { fbProc.kill("SIGKILL"); } catch {}
            reject(new RenderError("ffmpeg_error", `ffmpeg fallback timed out after ${FFMPEG_TIMEOUT_MS}ms: ${ffmpegStderr.slice(0,400)}`));
          }, FFMPEG_TIMEOUT_MS)
        ),
      ]);
      exitCode = fbRes.code;
      exitSignal = fbRes.signal;
      if (exitCode !== 0) {
        const sigPart2 = exitSignal ? ` signal ${exitSignal}` : "";
        const combined = `first:${firstStderr.slice(0,300)} | fallback:${ffmpegStderr.slice(0,500)}`;
        throw new RenderError("ffmpeg_error", `ffmpeg encoding failed (exit ${exitCode ?? "null"}${sigPart2}): ${combined.slice(0,800)}`);
      }
    } else if (exitCode !== 0) {
      const sigPart = exitSignal ? ` signal ${exitSignal}` : "";
      const stderrTail = ffmpegStderr.trim().slice(-800) || "(no stderr)";
      throw new RenderError(
        "ffmpeg_error",
        `ffmpeg encoding failed (exit ${exitCode ?? "null"}${sigPart}): ${stderrTail.slice(0, 800)}`
      );
    }
    if (frameCount === 0) {
      throw new RenderError(
        "RENDER_TIMEOUT",
        `No frames captured during the ${durationSec}s recording. The page may be static or unresponsive.`
      );
    }

    // ── Read output ───────────────────────────────────────────────────────
    let buffer: Buffer;
    if (tmpFile) {
      try {
        buffer = await readFile(tmpFile);
      } catch (e) {
        const stderrTail = ffmpegStderr.trim().slice(-500);
        throw new RenderError(
          "ffmpeg_error",
          `ffmpeg finished but output missing (${tmpFile}): ${e instanceof Error ? e.message : String(e)} stderr: ${stderrTail.slice(0, 500)}`
        );
      }
      if (!buffer || buffer.length === 0) {
        // Fallback: if file empty, try stdoutChunks (covers edge where gif piped)
        if (stdoutChunks.length > 0) buffer = Buffer.concat(stdoutChunks);
        else {
          throw new RenderError(
            "ffmpeg_error",
            `ffmpeg produced empty output (0 bytes) for ${format} — ${ffmpegStderr.slice(0, 800)}`
          );
        }
      }
    } else {
      // Fallback pipe path (should not happen now that useFile=true, kept for safety)
      buffer = Buffer.concat(stdoutChunks);
    }

    return { buffer, format, width, height };
  } catch (err) {
    cleanAbort = true;
    scrollAbort = true;
    if (ffmpegProc && ffmpegProc.exitCode === null) ffmpegProc.kill("SIGKILL");
    try { (page as unknown as { off: (e: string, h: (...a: unknown[]) => void) => void }).off("dialog", dialogHandler as unknown as (...a: unknown[]) => void); } catch {}
    if (err instanceof RenderError) throw err;
    throw new RenderError(
      "RENDER_TIMEOUT",
      `Video capture failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    cleanAbort = true;
    try { (page as unknown as { off: (e: string, h: (...a: unknown[]) => void) => void }).off("dialog", dialogHandler as unknown as (...a: unknown[]) => void); } catch {}
    // Clean up temp dir.
    if (tmpDir) rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
