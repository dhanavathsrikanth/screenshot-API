import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

// ─── Keep-alive for Render free tier (15-min idle sleep) ─────────────
// Creates/updates an Upstash QStash cron schedule that pings /api/health
// every 5 minutes so the Render web service never falls asleep.
// Usage:
//   node scripts/setup-keepalive.mjs            create/update schedule
//   node scripts/setup-keepalive.mjs --list     show existing schedules
//   node scripts/setup-keepalive.mjs --remove   delete the keep-alive schedule
// Env: UPSTASH_QSTASH_TOKEN (required), RENDER_URL or KEEPALIVE_URL (required for setup)

const CRON_EVERY_5_MIN = "*/5 * * * *";
const SCHEDULE_LABEL = "screenshotapi-render-keepalive";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function requireAnyEnv(names) {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  throw new Error(`Missing required env. Tried: ${names.join(", ")}`);
}

function normalizeDestination(input) {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  if (!/\/api\/health$/i.test(url)) url = `${url}/api/health`;
  return url;
}

function getApiBase() {
  const qstashUrl = process.env.QSTASH_URL;
  if (qstashUrl) return `${qstashUrl.replace(/\/+$/, "")}/v1/schedules`;
  return "https://qstash.upstash.com/v1/schedules";
}

async function callQStash(token, path, options = {}) {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`QStash ${options.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return body;
}

async function main() {
  const mode = process.argv.includes("--remove")
    ? "remove"
    : process.argv.includes("--list")
      ? "list"
      : "setup";

  const token = requireAnyEnv(["UPSTASH_QSTASH_TOKEN", "QSTASH_TOKEN"]);

  const schedules = await callQStash(token, "");

  const existing = Array.isArray(schedules)
    ? schedules.filter(
        (s) =>
          typeof s?.destination === "string" &&
          /\/api\/health$/i.test(s.destination)
      )
    : [];

  if (mode === "list") {
    if (existing.length === 0) {
      console.log("[keepalive] No /api/health schedules found.");
    } else {
      for (const s of existing) {
        console.log(`[keepalive] ${s.scheduleId}  ${s.cron}  ${s.destination}`);
      }
    }
    return;
  }

  if (mode === "remove") {
    if (existing.length === 0) {
      console.log("[keepalive] Nothing to remove.");
      return;
    }
    for (const s of existing) {
      await callQStash(token, `/${s.scheduleId}`, { method: "DELETE" });
      console.log(`[keepalive] Removed ${s.scheduleId} (${s.destination})`);
    }
    return;
  }

  // ── setup ──────────────────────────────────────────────────────────
  const rawUrl = process.argv
    .find((a) => a.startsWith("--url="))
    ?.slice("--url=".length);
  const baseUrl = rawUrl || requireAnyEnv(["RENDER_URL", "KEEPALIVE_URL"]);
  const destination = normalizeDestination(baseUrl);

  console.log(`[keepalive] Destination: ${destination}`);
  console.log(`[keepalive] QStash API: ${getApiBase()}`);
  console.log(`[keepalive] Schedule: ${CRON_EVERY_5_MIN} (every 5 min, max gap 5 min < 15-min sleep)`);

  for (const s of existing) {
    await callQStash(token, `/${s.scheduleId}`, { method: "DELETE" });
    console.log(`[keepalive] Replaced old schedule ${s.scheduleId} (${s.destination})`);
  }

  const created = await callQStash(token, "", {
    method: "POST",
    headers: {
      "Upstash-Retries": "0", // wake-up timeouts must not burn free messages on retries
      "Upstash-Timeout": "60000", // allow up to 60s for Render to boot from sleep
    },
    body: JSON.stringify({
      destination,
      cron: CRON_EVERY_5_MIN,
    }),
  });

  console.log(`[keepalive] Created schedule ${created?.scheduleId} -> ${destination}`);
  console.log(`[keepalive] Done. Render service stays awake 24/7 on the free tier.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
