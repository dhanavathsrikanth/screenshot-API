import { spawn } from "node:child_process";
import { logger } from "@/lib/logger";
import { loadAgentBrowserConfig } from "@/lib/agent-browser/config";

/**
 * Safe subprocess runner for the agent-browser CLI.
 *
 * agent-browser has a client-daemon architecture: the first command spawns a
 * background daemon that persists between calls. We reuse a single isolated
 * session per render so multi-step flows (open -> wait -> screenshot) share
 * one browser, and we always close the session when the render is done.
 */
export interface AgentBrowserCommandResult {
  /** Parsed JSON data when the CLI emitted `--json`, else raw text. */
  data: unknown;
  /** Raw stdout text. */
  stdout: string;
  /** Exit code, or null when killed by timeout. */
  exitCode: number | null;
  timedOut: boolean;
}

export interface RunOptions {
  session?: string;
  timeoutMs?: number;
  json?: boolean;
  /** Extra agent-browser CLI args prepended before the subcommand. */
  extraArgs?: string[];
}

function buildCommand(args: string[], opts: RunOptions, config: ReturnType<typeof loadAgentBrowserConfig>): string[] {
  const argv: string[] = [];
  if (opts.session) argv.push("--session", opts.session);
  for (const a of config.extraArgs) argv.push(a);
  for (const a of opts.extraArgs ?? []) argv.push(a);
  if (opts.json) argv.push("--json");
  argv.push(...args);
  return argv;
}

/**
 * Run an agent-browser CLI command. Throws an Error on nonzero exit or
 * timeout so callers can fall back (further) or raise a RenderError.
 */
export async function runAgentBrowser(
  args: string[],
  opts: RunOptions = {}
): Promise<AgentBrowserCommandResult> {
  const config = loadAgentBrowserConfig();
  if (!config.binaryPath) {
    throw new Error("agent-browser binary not available");
  }

  const argv = buildCommand(args, opts, config);
  const timeoutMs = opts.timeoutMs ?? config.timeoutMs;
  const bin = config.binaryPath;

  logger.info({ event: "agent_browser_cmd", argv: argv.join(" ") });

  return new Promise<AgentBrowserCommandResult>((resolve, reject) => {
    // Point agent-browser at a browser executable so it does NOT need to
    // download its own Chrome on Render. It reads AGENT_BROWSER_EXECUTABLE_PATH
    // automatically (see agent-browser cli/src/flags.rs). We prefer reusing
    // Puppeteer's already-installed Chromium.
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (config.chromePath) env.AGENT_BROWSER_EXECUTABLE_PATH = config.chromePath;
    // If we only have the JS wrapper (native binary not resolvable), run it
    // through Node; otherwise spawn the native binary / PATH command directly.
    const usesNode = bin.endsWith(".js");
    const child = spawn(usesNode ? process.execPath : bin, usesNode ? [bin, ...argv] : argv, {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn agent-browser: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const result: AgentBrowserCommandResult = {
        data: undefined,
        stdout,
        exitCode: code,
        timedOut,
      };
      if (timedOut) {
        const msg = `agent-browser timed out after ${timeoutMs}ms: ${args.join(" ")}`;
        logger.warn({ event: "agent_browser_timeout", args: args.join(" "), stderr, message: msg });
        reject(new Error(msg));
        return;
      }
      if (code !== 0) {
        const excerpt = (stderr || stdout).trim().slice(0, 800);
        logger.warn({ event: "agent_browser_nonzero", code, args: args.join(" "), stderr, message: excerpt });
        reject(new Error(`agent-browser exited ${code}: ${excerpt}`));
        return;
      }
      try {
        result.data = JSON.parse(stdout);
      } catch {
        result.data = stdout.trim();
      }
      resolve(result);
    });
  });
}

/** Run a single command and return the JSON body's `data` field (if present). */
export async function runAgentBrowserData<T = unknown>(
  args: string[],
  opts: RunOptions = {}
): Promise<T> {
  const res = await runAgentBrowser(args, { ...opts, json: true });
  if (
    res.data &&
    typeof res.data === "object" &&
    "data" in (res.data as Record<string, unknown>)
  ) {
    return (res.data as Record<string, unknown>).data as T;
  }
  return res.data as T;
}

/** Close the isolated session — best-effort, never throws. */
export async function closeAgentBrowserSession(session: string): Promise<void> {
  if (!session) return;
  try {
    await runAgentBrowser(["close"], { session, timeoutMs: 8000 });
  } catch {
    // best-effort — daemon idle timeout cleans up anyway
  }
}
