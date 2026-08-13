import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import DodoPayments from "dodopayments";
import { createClient } from "@supabase/supabase-js";

// Reconcile user plans from Dodo subscriptions.
//
// Backfill for the webhook bug where a successful payment/webhook did not
// upgrade user_quotas.plan (opaque product IDs missed the env map). Derives
// the authoritative plan for every active Dodo subscription (env map ->
// product metadata -> name string) and aligns user_quotas, mirroring
// upgradePlan() + syncCreditBalance() in the webhook.
//
// Usage:
//   node scripts/reconcile-dodo-plans.mjs                   # dry run (report)
//   node scripts/reconcile-dodo-plans.mjs --apply           # write to Supabase
//   node scripts/reconcile-dodo-plans.mjs --sub sub_xxx     # one subscription
//   node scripts/reconcile-dodo-plans.mjs --user user_xxx   # one user
//   node scripts/reconcile-dodo-plans.mjs --email a@b.com   # one email
//   (repeat --sub/--user/--email to target multiple)

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

function argValues(name) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
}

const SUB_FILTERS = argValues("--sub");
const USER_FILTERS = argValues("--user");
const EMAIL_FILTERS = argValues("--email").map((e) => e.toLowerCase());
const hasFilter = SUB_FILTERS.length > 0 || USER_FILTERS.length > 0 || EMAIL_FILTERS.length > 0;

// ── Env ──────────────────────────────────────────────────────────────────

function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === null || v === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

function requireAnyEnv(names) {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  throw new Error(`Missing required env. Tried: ${names.join(", ")}`);
}

const dodoConfig = {
  apiKey: requireAnyEnv(["DODO_PAYMENTS_API_KEY", "DODO_API_KEY", "DODOPAYMENTS_API_KEY"]),
  environment: process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode",
  creditEntitlementId: process.env.DODO_CREDIT_ENTITLEMENT_ID,
};

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// ── Clients ─────────────────────────────────────────────────────────────

const dodo = new DodoPayments({
  bearerToken: dodoConfig.apiKey,
  environment: dodoConfig.environment,
});

const supabase = createClient(supabaseUrl, supabaseKey);

// ── Plan resolution (mirrors src/app/api/webhooks/dodo/route.ts) ─────────

const PLAN_IDS = ["starter", "pro"];

function planInfoFor(plan) {
  return plan === "pro"
    ? { plan: "pro", credits: 15000, monthlyLimit: 15000 }
    : { plan: "starter", credits: 2500, monthlyLimit: 2500 };
}

const ENV_PLAN_MAP = [
  [process.env.NEXT_PUBLIC_DODO_PRODUCT_STARTER_ID, "starter"],
  [process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO_ID, "pro"],
];

async function resolvePlanFromProduct(productId) {
  if (!productId) return null;

  for (const [pid, plan] of ENV_PLAN_MAP) {
    if (pid && pid === productId) return planInfoFor(plan);
  }

  try {
    const product = await dodo.products.retrieve(productId);
    const metaPlan = product?.metadata?.plan;
    if (PLAN_IDS.includes(metaPlan)) return planInfoFor(metaPlan);
  } catch (err) {
    console.error(`  [warn] Failed to fetch product ${productId}:`, err?.message ?? err);
  }

  const lower = productId.toLowerCase();
  if (lower.includes("pro")) return planInfoFor("pro");
  if (lower.includes("starter")) return planInfoFor("starter");

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function toCredits(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

async function loadUsers() {
  const byDodoCustomerId = new Map();
  const byEmail = new Map();
  const byId = new Map();

  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, dodo_customer_id")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to load users: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const u of data) {
      byId.set(u.id, u);
      if (u.dodo_customer_id) byDodoCustomerId.set(u.dodo_customer_id, u);
      if (u.email) byEmail.set(String(u.email).toLowerCase(), u);
    }

    from += data.length;
    if (data.length < pageSize) break;
  }

  console.log(`[users] Loaded ${byId.size} users (${byDodoCustomerId.size} with Dodo customer mapping)`);
  return { byDodoCustomerId, byEmail, byId };
}

function resolveUserForSubscription(sub, maps) {
  const customerId = sub?.customer?.customer_id ?? sub?.customer_id;
  const email = (sub?.customer?.email ?? "").toLowerCase();

  const byCustomer = maps.byDodoCustomerId.get(customerId);
  if (byCustomer) return byCustomer;

  if (email) {
    const byMail = maps.byEmail.get(email);
    if (byMail) return byMail;
  }

  return null;
}

// ── Load subscriptions ───────────────────────────────────────────────────

// Only `active` subscriptions entitle a plan. `pending` (payment not collected)
// and `on_hold` (payment failed) must NOT grant access.
const ACTIVE_STATUSES = ["active"];

async function loadSubscriptions(maps) {
  const subs = [];

  if (SUB_FILTERS.length > 0) {
    for (const id of SUB_FILTERS) {
      subs.push(await dodo.subscriptions.retrieve(id));
    }
  } else {
    for (const status of ACTIVE_STATUSES) {
      for await (const sub of dodo.subscriptions.list({ status, page_size: 100 })) {
        subs.push(sub);
      }
    }
  }

  // Keep the best (most recently created) active subscription per user.
  const bestByUser = new Map();
  for (const sub of subs) {
    const user = resolveUserForSubscription(sub, maps);
    if (!user) {
      console.log(`  [skip] Subscription ${sub.subscription_id} -> no matching user (customer ${sub?.customer?.customer_id ?? "?"}, email ${sub?.customer?.email ?? "?"})`);
      continue;
    }

    const statusRank = ACTIVE_STATUSES.indexOf(sub.status);
    const existing = bestByUser.get(user.id);
    if (!existing) {
      bestByUser.set(user.id, { sub, statusRank });
    } else if (statusRank < existing.statusRank) {
      bestByUser.set(user.id, { sub, statusRank });
    } else if (statusRank === existing.statusRank && new Date(sub.created_at) > new Date(existing.sub.created_at)) {
      bestByUser.set(user.id, { sub, statusRank });
    }
  }

  console.log(`[subs] Loaded ${subs.length} subscription(s), ${bestByUser.size} with a resolvable user`);
  return bestByUser;
}

// ── Fetch authoritative credit balance from Dodo ─────────────────────────

async function fetchCreditBalance(customerId) {
  if (!customerId || !dodoConfig.creditEntitlementId) return null;
  try {
    const balance = await dodo.creditEntitlements.balances.retrieve(customerId, {
      credit_entitlement_id: dodoConfig.creditEntitlementId,
    });
    return toCredits(balance?.balance);
  } catch (err) {
    console.error(`  [warn] Failed to fetch Dodo balance for ${customerId}:`, err?.message ?? err);
    return null;
  }
}

// ── Reconcile one user ───────────────────────────────────────────────────

async function reconcileUser(user, sub) {
  const planInfo = await resolvePlanFromProduct(sub.product_id);

  if (!planInfo) {
    console.log(`\n[user] ${user.id} (${user.email ?? "no email"})`);
    console.log(`  [warn] No plan mapping for product ${sub.product_id} — leaving untouched`);
    return { action: "skipped" };
  }

  const { data: quota } = await supabase
    .from("user_quotas")
    .select("plan, monthly_limit, overage_enabled, credit_balance, top_up_balance, dodo_subscription_id, dodo_product_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId = sub?.customer?.customer_id ?? sub?.customer_id ?? null;
  const creditBalance = await fetchCreditBalance(customerId);

  const changes = {};

  if (!quota || quota.plan !== planInfo.plan) changes.plan = planInfo.plan;
  if (!quota || Number(quota.monthly_limit) !== planInfo.monthlyLimit) changes.monthly_limit = planInfo.monthlyLimit;
  if (!quota || quota.overage_enabled !== true) changes.overage_enabled = true;
  if (!quota || quota.dodo_subscription_id !== sub.subscription_id) changes.dodo_subscription_id = sub.subscription_id;
  if (!quota || quota.dodo_product_id !== sub.product_id) changes.dodo_product_id = sub.product_id;
  if (creditBalance !== null && (!quota || Number(quota.credit_balance) !== creditBalance)) {
    changes.credit_balance = creditBalance;
  }

  console.log(`\n[user] ${user.id} (${user.email ?? "no email"})`);
  console.log(`  sub=${sub.subscription_id} status=${sub.status} product=${sub.product_id}`);
  console.log(`  resolved plan=${planInfo.plan} current=${quota?.plan ?? "free"} balance(Dodo)=${creditBalance}`);

  if (Object.keys(changes).length === 0) {
    console.log("  already in sync — nothing to do");
    return { action: "noop" };
  }

  console.log(`  changes: ${JSON.stringify(changes)}`);

  if (!APPLY) {
    return { action: "would-update", changes };
  }

  // Preserve leftover free credits as top-up when moving free -> paid (mirrors upgradePlan).
  if (quota && quota.plan === "free") {
    const freeRemainder = Math.max(0, Number(quota.credit_balance ?? 0));
    if (freeRemainder > 0 && !changes.credit_balance) {
      changes.top_up_balance = freeRemainder;
      changes.credit_balance = creditBalance ?? 0;
    }
  }

  const { error } = quota
    ? await supabase.from("user_quotas").update(changes).eq("user_id", user.id)
    : await supabase.from("user_quotas").upsert({ user_id: user.id, ...changes }, { onConflict: "user_id" });

  if (error) {
    console.error(`  [error] Failed to update: ${error.message}`);
    return { action: "error", error: error.message };
  }

  console.log("  updated");
  return { action: "updated", changes };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[env] Dodo environment: ${dodoConfig.environment} (apply=${APPLY})`);
  if (dodoConfig.environment === "test_mode" && dodoConfig.apiKey.startsWith("sk_live_")) {
    throw new Error("DODO_PAYMENTS_ENVIRONMENT=test_mode but the API key is live. Aborting.");
  }

  const maps = await loadUsers();
  const bestByUser = await loadSubscriptions(maps);

  const totals = { noop: 0, "would-update": 0, updated: 0, skipped: 0, error: 0 };

  for (const [userId, { sub }] of bestByUser) {
    const user = maps.byId.get(userId);
    if (hasFilter) {
      const matchUser = USER_FILTERS.includes(userId);
      const matchEmail = EMAIL_FILTERS.includes((user?.email ?? "").toLowerCase());
      const matchSub = SUB_FILTERS.includes(sub.subscription_id);
      if (!matchUser && !matchEmail && !matchSub) continue;
    }
    const result = await reconcileUser(user, sub);
    totals[result.action] += 1;
  }

  console.log(`\n[done] ${APPLY ? "APPLIED" : "DRY RUN"} — noop: ${totals.noop}, would-update: ${totals["would-update"]}, updated: ${totals.updated}, skipped: ${totals.skipped}, errors: ${totals.error}`);
  if (!APPLY && (totals["would-update"] > 0 || totals.skipped > 0)) {
    console.log("Re-run with --apply to write the changes.");
  }
}

main().catch((err) => {
  console.error("Reconciliation failed:", err?.message || err);
  process.exit(1);
});
