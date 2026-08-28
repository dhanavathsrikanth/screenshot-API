import puppeteer, { Browser } from "puppeteer";
import { logger } from "@/lib/logger";

/**
 * Owns the singleton, warm Chrome process (blueprint §29–§30).
 *
 * Lifecycle:
 *   launch → keep warm → on disconnect: null out → relaunch on next use.
 *
 * Crash recovery: `withBrowserRetry` detects connection-level failures,
 * kills the browser, relaunches it, and re-runs the work exactly once.
 * It never retries indefinitely.
 */

let browser: Browser | null = null;
let browserReady: Promise<Browser> | null = null;

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--disable-gpu",
  "--disable-extensions",
  "--disable-background-networking",
];

function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

function resetBrowser(): void {
  browser = null;
  browserReady = null;
}

async function launch(): Promise<Browser> {
  if (isServerless()) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      headless: true,
      executablePath: await chromium.executablePath(),
      args: chromium.args.concat(LAUNCH_ARGS),
    });
  }

  return puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: LAUNCH_ARGS,
  });
}

/** Get (and lazily launch) the warm shared browser. */
export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  if (browserReady) return browserReady;

  browserReady = (async () => {
    const b = await launch();
    b.on("disconnected", () => {
      logger.warn({ event: "browser_disconnected" });
      resetBrowser();
    });
    browser = b;
    return b;
  })();

  return browserReady;
}

/**
 * True when an error indicates the browser process itself became unusable
 * (crashed / target destroyed) rather than a business-logic failure.
 */
export function isCrashError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /(Connection closed|Connection reset|Protocol error|Target closed|Session closed|Session Terminated|Target page, context or browser has been closed|Browser has been disconnected|Execution context was destroyed|Cannot navigate to invalid URL)/i.test(
    msg
  );
}

async function kill(): Promise<void> {
  const current = browser;
  resetBrowser();
  if (current && current.connected) {
    try {
      await current.close();
    } catch {
      // already dead
    }
  }
}

/**
 * Run work against the warm browser. If the browser crashes mid-work,
 * kill it, relaunch, and retry exactly once.
 */
export async function withBrowserRetry<T>(fn: (b: Browser) => Promise<T>): Promise<T> {
  const b = await getBrowser();
  try {
    return await fn(b);
  } catch (error) {
    if (!isCrashError(error)) throw error;
    logger.warn({ event: "browser_crash_recovery", error: error instanceof Error ? error.message : error });
    await kill();
    const relaunched = await getBrowser();
    return fn(relaunched);
  }
}

/** Close the browser (used by tests/shutdown hooks). */
export async function shutdownBrowser(): Promise<void> {
  await kill();
}
