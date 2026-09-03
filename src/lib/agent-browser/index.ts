/**
 * agent-browser integration — public surface.
 *
 * Use agent-browser as a *robust fallback* engine on top of the primary
 * Puppeteer pipeline. Everything is optional at runtime: when the binary is
 * not installed (AGENT_BROWSER_ENABLED=0, or no binary found), all callers
 * receive "unavailable" results and the existing Puppeteer path is untouched.
 */
export {
  loadAgentBrowserConfig,
  buildMcpLaunchArgs,
  resolveMcpTools,
  type AgentBrowserConfig,
} from "@/lib/agent-browser/config";

export {
  runAgentBrowser,
  runAgentBrowserData,
  closeAgentBrowserSession,
  type AgentBrowserCommandResult,
  type RunOptions,
} from "@/lib/agent-browser/client";

export {
  renderViaAgentBrowser,
} from "@/lib/agent-browser/fallback";

export {
  tryAgentBrowserFallbackRender,
  isAgentBrowserUsable,
  shouldFallbackOnError,
  type AgentFallbackDecision,
} from "@/lib/agent-browser/gate";
