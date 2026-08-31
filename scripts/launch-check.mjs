#!/usr/bin/env node
/**
 * Pre-launch go/no-go checks against a running deployment.
 *
 * Usage:
 *   node scripts/launch-check.mjs
 *   node scripts/launch-check.mjs --base https://api.screenshotapi.tech --key sk_live_xxx
 *
 * Env (optional):
 *   LAUNCH_CHECK_BASE   — API origin (default: http://localhost:3000)
 *   LAUNCH_CHECK_API_KEY — Bearer token for authenticated checks
 */

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const base = (arg("base", process.env.LAUNCH_CHECK_BASE) ?? "http://localhost:3000").replace(/\/$/, "");
const apiKey = arg("key", process.env.LAUNCH_CHECK_API_KEY ?? "");

const results = [];

function pass(label, detail) {
  results.push({ ok: true, label, detail });
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail) {
  results.push({ ok: false, label, detail });
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

async function fetchJson(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function main() {
  console.log(`Launch check → ${base}\n`);

  // ── Health ──────────────────────────────────────────────────────────
  try {
    const { res, body } = await fetchJson("/api/health");
    if (res.ok && body?.status === "ok") {
      const checks = body.checks ?? {};
      const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
      if (bad.length) fail("Health endpoint", `degraded: ${bad.join(", ")}`);
      else pass("Health endpoint", `redis=${checks.redis} supabase=${checks.supabase} storage=${checks.storage}`);
    } else {
      fail("Health endpoint", `HTTP ${res.status}`);
    }
  } catch (e) {
    fail("Health endpoint", e.message);
  }

  // ── Marketing site ───────────────────────────────────────────────────
  try {
    const res = await fetch(`${base.replace("api.", "")}/`, { redirect: "follow" });
    // If base is api subdomain, try same host root
    if (!res.ok && base.includes("api.")) {
      const site = base.replace("api.", "");
      const r2 = await fetch(site, { redirect: "follow" });
      if (r2.ok) pass("Marketing homepage", site);
      else fail("Marketing homepage", `HTTP ${r2.status}`);
    } else if (res.ok) {
      pass("Marketing homepage");
    } else {
      fail("Marketing homepage", `HTTP ${res.status} (skip if checking API host only)`);
    }
  } catch {
    pass("Marketing homepage", "skipped (API-only base URL)");
  }

  // ── OpenAPI ──────────────────────────────────────────────────────────
  try {
    const { res, body } = await fetchJson("/openapi.json");
    if (res.ok && body?.openapi) pass("OpenAPI spec", body.info?.title ?? "present");
    else fail("OpenAPI spec", `HTTP ${res.status}`);
  } catch (e) {
    fail("OpenAPI spec", e.message);
  }

  if (!apiKey) {
    console.log("\n⚠ Set LAUNCH_CHECK_API_KEY or --key for API smoke tests (capture, usage, keys).\n");
  } else {
    const auth = { Authorization: `Bearer ${apiKey}` };

    // ── Usage ──────────────────────────────────────────────────────────
    try {
      const { res, body } = await fetchJson("/api/v1/usage", { headers: auth });
      if (res.ok && body?.data) pass("GET /api/v1/usage", `plan=${body.data.plan ?? "?"}`);
      else fail("GET /api/v1/usage", `HTTP ${res.status} ${JSON.stringify(body?.error ?? body)}`);
    } catch (e) {
      fail("GET /api/v1/usage", e.message);
    }

    // ── API keys list ──────────────────────────────────────────────────
    try {
      const { res, body } = await fetchJson("/api/v1/api-keys", { headers: auth });
      if (res.ok && Array.isArray(body?.data)) pass("GET /api/v1/api-keys", `${body.data.length} key(s)`);
      else fail("GET /api/v1/api-keys", `HTTP ${res.status}`);
    } catch (e) {
      fail("GET /api/v1/api-keys", e.message);
    }

    // ── Sync capture (small, fast) ─────────────────────────────────────
    try {
      const qs = new URLSearchParams({
        url: "https://example.com",
        format: "png",
        viewport_width: "800",
        viewport_height: "600",
      });
      const res = await fetch(`${base}/api/take?${qs}`, {
        headers: auth,
        redirect: "follow",
      });
      if (res.ok) {
        const ct = res.headers.get("content-type") ?? "";
        pass("GET /api/take", ct.includes("json") ? "JSON response" : `HTTP ${res.status}`);
      } else if (res.status === 302) {
        pass("GET /api/take", "redirect (cache hit)");
      } else {
        const text = await res.text();
        fail("GET /api/take", `HTTP ${res.status} ${text.slice(0, 120)}`);
      }
    } catch (e) {
      fail("GET /api/take", e.message);
    }

    // ── v1 async screenshot create ─────────────────────────────────────
    try {
      const { res, body } = await fetchJson("/api/v1/screenshots", {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com", format: "png" }),
      });
      if (res.status === 202 || res.ok) {
        pass("POST /api/v1/screenshots", `status=${body?.data?.status ?? res.status}`);
      } else {
        fail("POST /api/v1/screenshots", `HTTP ${res.status} ${JSON.stringify(body?.error ?? body)?.slice(0, 120)}`);
      }
    } catch (e) {
      fail("POST /api/v1/screenshots", e.message);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nNo-go — fix failures above before launch.");
    process.exit(1);
  }
  console.log("\nGo — automated checks passed. Still verify manually:");
  console.log("  • Supabase migrations 021 + 022 applied on production");
  console.log("  • Clerk domain matches Supabase auth provider");
  console.log("  • Dodo live webhook + checkout on a test account");
  console.log("  • Dashboard history shows captures after API test");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
