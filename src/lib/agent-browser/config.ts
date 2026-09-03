import { existsSync } from "node:fs";

/**
 * agent-browser binary discovery + MCP launch configuration.
 *
 * agent-browser is a native Rust CLI that drives its own Chrome through a
 * background daemon. It is NOT a drop-in for the in-process Puppeteer browser —
 * it launches a separate browser. We use it strictly as a *fallback* engine:
 * when the Puppeteer pipeline fails (bot-block, crash, selector not found) we
 * shell out to agent-browser's Agent Core flow. This file keeps every
 * binary/config concern in one place so the render pipeline stays clean.
 */

export interface AgentBrowserConfig {
  /** Absolute path to the agent-browser binary, or null when not available. */
  binaryPath: string | null;
  /** MCP tools profile ("" = default core; "all"; "core,network,react"). */
  mcpTools: string;
  /** Per-render timeout in ms for fallback subprocess work. */
  timeoutMs: number;
  /** Isolate fallback sessions with this prefix. */
  sessionPrefix: string;
  /** Extra launch args forwarded to agent-browser (e.g. ["--headed"]). */
  extraArgs: string[];
  /** Path to a Chromium/Chrome agent-browser should reuse (reuses Puppeteer's). */
  chromePath: string | null;
}

/** Resolve the MCP tools profile from config/env. */
export function resolveMcpTools(opts?: { mcpTools?: string }): string {
  const raw =
    opts?.mcpTools ??
    process.env.AGENT_BROWSER_MCP_TOOLS ??
    process.env.AGENT_BROWSER_MCP_TOOL_PROFILE ??
    "";
  const v = raw.trim();
  if (!v) return "";
  // Sanitize: only allowed tokens (core, network, react, state, debug, tabs, mobile, all)
  const allowed = new Set([
    "core", "network", "react", "state", "debug", "tabs", "mobile", "all",
  ]);
  const parts = v.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const clean = parts.filter((p) => allowed.has(p));
  return clean.length ? clean.join(",") : "";
}

/** Candidate locations for the agent-browser binary, in priority order. */
function resolveCandidates(): string[] {
  const raw = process.env.AGENT_BROWSER_BIN?.trim();
  const candidates: string[] = [];
  if (raw) candidates.push(raw);

  // Local project node_modules (added as a project dependency).
  try {
    const localBin = require.resolve("agent-browser/bin/agent-browser.js");
    if (localBin) candidates.push(localBin);
  } catch {
    /* not a local dep — fall through to PATH */
  }

  // npm global + common install locations.
  candidates.push(
    "agent-browser", // PATH lookup fallback
    ...(process.platform === "win32"
      ? [
          `${process.env.APPDATA || ""}\\npm\\agent-browser.cmd`,
          `${process.env.LOCALAPPDATA || ""}\\Programs\\agent-browser\\agent-browser.exe`,
        ]
      : [
          "/usr/local/bin/agent-browser",
          "/usr/bin/agent-browser",
          `${process.env.HOME || ""}/.local/bin/agent-browser`,
          `${process.env.HOME || ""}/.agent-browser/bin/agent-browser`,
        ]),
  );

  return candidates.filter((c) => c.length > 0);
}

/** Return the first existing binary path (PATH names verified via exists on win). */
function findBinary(candidates: string[]): string | null {
  for (const c of candidates) {
    // Bare command name — trust PATH.
    if (!c.includes("/") && !c.includes("\\")) return c;
    if (!existsSync(c)) continue;
    // Resolve the JS wrapper to its sibling native binary when present, so we
    // can spawn the native executable directly (fast, no Node interpreter in
    // the path). Falls back to the wrapper for `spawn` via node otherwise.
    return resolveNativeBinary(c);
  }
  return null;
}

/** Map the JS wrapper path to the platform native binary in the same bin dir. */
function resolveNativeBinary(path: string): string {
  const norm = path.replace(/\\/g, "/");
  if (!norm.endsWith("/bin/agent-browser.js")) return path;

  const binDir = norm.slice(0, norm.lastIndexOf("/"));
  const platformKey = process.platform === "win32" ? "win32" : "linux";
  const archKey = process.arch === "arm64" ? "arm64" : "x64";
  const ext = process.platform === "win32" ? ".exe" : "";
  const name = `agent-browser-${platformKey}-${archKey}${ext}`;
  const native = `${binDir}/${name}`;
  return existsSync(native) ? native : path;
}

/**
 * Resolve a Chromium/Chrome executable for agent-browser to reuse.
 *
 * Priority:
 *   1. AGENT_BROWSER_EXECUTABLE_PATH (explicit override)
 *   2. CHROME_PATH (app-level Chrome override)
 *   3. Puppeteer's own bundled Chromium (its cache dir) — avoids a second
 *      Chrome download in prod; the biggest reliability win on Render.
 */
export function resolveChromePath(): string | null {
  const explicit =
    process.env.AGENT_BROWSER_EXECUTABLE_PATH?.trim() ||
    process.env.CHROME_PATH?.trim();
  if (explicit && explicit.length > 0) return explicit;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require("puppeteer");
    const path = puppeteer.executablePath?.();
    if (typeof path === "string" && path.length > 0 && existsSync(path)) {
      return path;
    }
  } catch {
    /* puppeteer not resolvable — fall through */
  }

  // Puppeteer's documented cache dir (matches puppeteer.config.cjs -> .cache/puppeteer).
  const cacheCandidates = [
    `${process.env.HOME || ""}/.cache/puppeteer`,
    `${process.env.HOME || ""}/.cache/puppeteer`,
    "node_modules/.cache/puppeteer",
  ];
  for (const base of cacheCandidates) {
    try {
      const channels = ["chrome", "chrome-headless-shell"];
      for (const channel of channels) {
        const binDir = `${base}/${channel}`;
        if (!existsSync(binDir)) continue;
        const names = ["chrome", "chromium", "chrome.exe", "headless_shell"];
        for (const name of names) {
          const p = `${binDir}/${name}`;
          if (existsSync(p)) return p;
        }
      }
    } catch {
      /* malformed path — skip */
    }
  }

  return null;
}

/**
 * Load effective agent-browser config. Gracefully returns `binaryPath: null`
 * when the binary is unavailable so the render pipeline can skip fallback
 * without throwing (pure Puppeteer continues to work).
 */
export function loadAgentBrowserConfig(opts?: { mcpTools?: string }): AgentBrowserConfig {
  const enabled =
    (process.env.AGENT_BROWSER_ENABLED ?? "1") !== "0" &&
    (process.env.AGENT_BROWSER_DISABLED ?? "0") !== "1";

  let binaryPath: string | null = null;
  if (enabled) {
    binaryPath = findBinary(resolveCandidates());
  }

  return {
    binaryPath,
    mcpTools: resolveMcpTools(opts),
    timeoutMs: Number(process.env.AGENT_BROWSER_TIMEOUT_MS || 40_000),
    sessionPrefix: process.env.AGENT_BROWSER_SESSION_PREFIX || "screenshot-fallback",
    extraArgs: parseExtraArgs(process.env.AGENT_BROWSER_EXTRA_ARGS),
    chromePath: resolveChromePath(),
  };
}

function parseExtraArgs(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Build the argv for launching the agent-browser MCP stdio server. Returns
 * null when the binary is unavailable. Mirrors the three documented modes:
 *
 *   agent-browser mcp
 *   agent-browser mcp --tools all
 *   agent-browser mcp --tools core,network,react
 */
export function buildMcpLaunchArgs(config: AgentBrowserConfig, opts?: { tools?: string }): string[] | null {
  if (!config.binaryPath) return null;
  const tools = resolveMcpTools({ mcpTools: opts?.tools ?? config.mcpTools });
  const argv = ["mcp"];
  if (tools) argv.push("--tools", tools);
  return argv;
}
