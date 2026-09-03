import { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";
import { getRequestId, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

function envPresent(key: string): boolean {
  return Boolean(process.env[key]);
}

/** Best-effort diagnostics for the render engines (never throws). */
async function browserDiagnostics() {
  const diag = {
    puppeteer_chrome: "unknown" as string,
    agent_browser_bin: "unknown" as string,
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = require("puppeteer");
    let p: string | null = null;
    try {
      p = puppeteer.executablePath?.() ?? null;
    } catch { /* older API */ }
    diag.puppeteer_chrome =
      p && p.length
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require("node:fs").existsSync(p) ? p : `${p} (missing)`)
        : "not resolvable";
  } catch (e) {
    diag.puppeteer_chrome = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadAgentBrowserConfig } = require("@/lib/agent-browser/config");
    const cfg = loadAgentBrowserConfig();
    diag.agent_browser_bin = cfg.binaryPath ? cfg.binaryPath : "not found";
  } catch (e) {
    diag.agent_browser_bin = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }
  return diag;
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  const checks = {
    redis: getRedis() !== null,
    supabase:
      envPresent("NEXT_PUBLIC_SUPABASE_URL") && envPresent("SUPABASE_SERVICE_ROLE_KEY"),
    storage: envPresent("R2_BUCKET_NAME") && envPresent("R2_ENDPOINT"),
  };

  const healthy = Object.values(checks).every(Boolean);
  const browser = await browserDiagnostics();

  if (!healthy) {
    return jsonError(503, "service_unavailable", "One or more upstream services are unavailable.", requestId, {
      checks,
      browser,
    });
  }

  return Response.json(
    {
      status: "ok",
      service: "screenshotapi",
      checks,
      browser,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        ...(requestId ? { "x-request-id": requestId } : {}),
      },
    }
  );
}
