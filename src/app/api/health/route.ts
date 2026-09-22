import { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";
import { createServiceClient } from "@/lib/supabase/server";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
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
    const puppeteerModule = await import("puppeteer");
    const puppeteer = puppeteerModule.default ?? puppeteerModule;
    let p: string | null = null;
    try {
      p = (await puppeteer.executablePath?.()) ?? null;
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

async function probeDependencies() {
  const redis = getRedis();
  const supabase = envPresent("NEXT_PUBLIC_SUPABASE_URL") && envPresent("SUPABASE_SERVICE_ROLE_KEY")
    ? createServiceClient()
    : null;

  const redisCheck = redis
    ? redis.get("__screenshotapi_health").then(() => true).catch(() => false)
    : Promise.resolve(false);
  const supabaseCheck = supabase
    ? Promise.resolve(
        supabase
          .from("user_quotas")
          .select("user_id", { head: true, count: "exact" })
          .limit(1)
      )
        .then(({ error }) => !error)
        .catch(() => false)
    : Promise.resolve(false);

  const storageConfigured = envPresent("R2_BUCKET_NAME") && envPresent("R2_ENDPOINT") &&
    envPresent("R2_ACCESS_KEY_ID") && envPresent("R2_SECRET_ACCESS_KEY");
  const storageCheck = storageConfigured
    ? new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      })
        .send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }))
        .then(() => true)
        .catch(() => false)
    : Promise.resolve(false);

  const [redisOk, supabaseOk, storageOk] = await Promise.all([redisCheck, supabaseCheck, storageCheck]);
  return { redis: redisOk, supabase: supabaseOk, storage: storageOk };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  const checks = await probeDependencies();

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
