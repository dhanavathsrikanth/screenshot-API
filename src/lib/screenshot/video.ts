import { type Page } from "puppeteer";
import { spawn, type ChildProcess } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { ScreenshotOptions } from "@/lib/schema";
import type { RenderResult } from "@/lib/screenshot/types";
import { RenderError } from "@/lib/screenshot/types";

/**
 * Resolve the path to the ffmpeg binary bundled by ffmpeg-static.
 * Returns null when the package isn't installed.
 */
function resolveFfmpegPath(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("ffmpeg-static") as string;
  } catch {
    return null;
  }
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
      return [
        ...input,
        "-vf", `${spedUp},fps=${outFps},split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
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
  // re-timed to `duration` via setpts. Clamp the recording window so it never
  // blows the 90s total render budget the engine allows (duration ≤ 30, speed
  // ≤ 4 normally means ≤ 120s — too long for the 90s budget with encode time).
  const MAX_RECORD_SECONDS = 75;
  const recordSec = Math.min(durationSec * speed, MAX_RECORD_SECONDS);

  // mp4/webm muxers require seekable output — use a temp file.
  const useFile = format === "mp4" || format === "webm";
  let tmpDir: string | null = null;
  let tmpFile: string | null = null;
  if (useFile) {
    tmpDir = await mkdtemp(join(tmpdir(), "vid-"));
    tmpFile = join(tmpDir, `out.${format}`);
  }

  let ffmpegProc: ChildProcess | null = null;
  let ffmpegFinished: Promise<number | null>;
  let ffmpegStderr = "";
  const stdoutChunks: Buffer[] = [];

  try {
    // ── Spawn ffmpeg ──────────────────────────────────────────────────────
    const args = ffmpegArgs(format, fps, width, height, speed, tmpFile ?? undefined);
    ffmpegProc = spawn(ffmpegPath, args, { stdio: ["pipe", "pipe", "pipe"] });
    ffmpegProc.stderr?.on("data", (chunk: Buffer) => { ffmpegStderr += chunk.toString(); });
    ffmpegProc.stdout?.on("data", (chunk: Buffer) => { stdoutChunks.push(chunk); });
    ffmpegFinished = new Promise<number | null>((resolve) => {
      ffmpegProc!.on("close", (code) => resolve(code));
      ffmpegProc!.on("error", () => resolve(null));
    });

    if (ffmpegProc.exitCode !== null) {
      throw new RenderError(
        "RENDER_TIMEOUT",
        `ffmpeg failed to start (exit ${ffmpegProc.exitCode}): ${ffmpegStderr.slice(0, 500)}`
      );
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
    let stopped = false;

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

      if (ffmpegProc && ffmpegProc.exitCode === null && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
        const ok = ffmpegProc.stdin.write(jpegBuf);
        if (!ok) {
          await new Promise<void>((r) => ffmpegProc!.stdin!.once("drain", r));
        }
      }

      try { await cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }); } catch { /* noop */ }
    });

    // ── Record for duration ───────────────────────────────────────────────
    await new Promise((r) => setTimeout(r, recordSec * 1000));
    await stopRecording();
    await new Promise((r) => setTimeout(r, 50)); // flush in-flight frames

    // ── Close ffmpeg stdin, wait for encoding ─────────────────────────────
    if (ffmpegProc && ffmpegProc.exitCode === null && ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
      ffmpegProc.stdin.end();
    }

    const exitCode = await ffmpegFinished;
    if (exitCode !== 0) {
      throw new RenderError(
        "ffmpeg_error",
        `ffmpeg encoding failed (exit ${exitCode}): ${ffmpegStderr.slice(0, 800)}`
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
      buffer = await readFile(tmpFile);
    } else {
      // gif: encoded bytes streamed to stdout during encoding — gather what
      // was already pushed onto stdoutChunks (a fresh listener attached here
      // would fire only after the process closed, yielding nothing).
      buffer = Buffer.concat(stdoutChunks);
    }

    return { buffer, format, width, height };
  } catch (err) {
    if (ffmpegProc && ffmpegProc.exitCode === null) ffmpegProc.kill("SIGKILL");
    if (err instanceof RenderError) throw err;
    throw new RenderError(
      "RENDER_TIMEOUT",
      `Video capture failed: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    // Clean up temp dir.
    if (tmpDir) rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
