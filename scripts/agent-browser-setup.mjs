#!/usr/bin/env node
/**
 * Set up the agent-browser fallback engine.
 *
 * agent-browser is a native Rust CLI (uses its own Chrome via a background
 * daemon) and is OPTIONAL in this project. The Puppeteer pipeline is primary;
 * agent-browser is used as a robust fallback when a render fails bot-block /
 * navigation / crash checks.
 *
 * This script:
 *   1. Installs the `agent-browser` npm package (global or local override).
 *   2. Runs `agent-browser install` to fetch Chrome for Testing (first time).
 *   3. Prints the MCP launch commands and config guidance.
 *
 * Usage:
 *   npm run agent-browser:setup
 *
 * Env:
 *   AGENT_BROWSER_BIN  — explicit path to an existing agent-browser binary
 *                       (skips global install when set).
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const log = (msg) => console.log(`[agent-browser] ${msg}`);

function run(cmd) {
  execSync(cmd, { stdio: "inherit", shell: true });
}

function main() {
  const explicit = process.env.AGENT_BROWSER_BIN;
  if (explicit && existsSync(explicit)) {
    log(`Using existing binary from AGENT_BROWSER_BIN=${explicit}`);
  } else {
    log("Installing agent-browser globally (native Rust binary)...");
    try {
      run("npm install -g agent-browser");
    } catch (e) {
      log(`Global install failed (${e.message}). Install manually and set AGENT_BROWSER_BIN.`);
      process.exit(1);
    }
  }

  log("Downloading Chrome for Testing (first run only)...");
  try {
    // On Linux (Render/Docker) also install the browser system libraries that
    // headless Chrome needs. `--with-deps` exits nonzero if it cannot install
    // every required library, so keep it best-effort here.
    const withDeps = process.platform === "linux" && process.argv.includes("--with-deps");
    run(withDeps ? "agent-browser install --with-deps" : "agent-browser install");
  } catch (e) {
    log(`agent-browser install warning: ${e.message}`);
  }

  log("");
  log("agent-browser ready. Enable with: AGENT_BROWSER_ENABLED=1");
  log("");
  log("MCP launch modes (use in your MCP client config):");
  log("  agent-browser mcp");
  log("  agent-browser mcp --tools all");
  log("  agent-browser mcp --tools core,network,react");
  log("");
  log("Example MCP client config (opencode.json / .mcp.json):");
  log(JSON.stringify(
    {
      mcpServers: {
        "agent-browser": { command: "agent-browser", args: ["mcp"] },
        "agent-browser-full": { command: "agent-browser", args: ["mcp", "--tools", "all"] },
        "agent-browser-mixed": { command: "agent-browser", args: ["mcp", "--tools", "core,network,react"] },
      },
    },
    null,
    2
  ));
  log("");
  log("Fallback env knobs:");
  log("  AGENT_BROWSER_ENABLED=1      enable fallback (default on when binary found)");
  log("  AGENT_BROWSER_DISABLED=1      force-disable fallback");
  log("  AGENT_BROWSER_TIMEOUT_MS=40000  per-fallback timeout");
}

main();
