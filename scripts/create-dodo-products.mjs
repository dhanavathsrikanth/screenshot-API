import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import DodoPayments from "dodopayments";

function requireEnv(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === null || v === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

function requireAnyEnv(names, fallback = undefined) {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env. Tried: ${names.join(", ")}`);
}

async function main() {
  const apiKey = requireAnyEnv(["DODO_PAYMENTS_API_KEY", "DODO_API_KEY", "DODOPAYMENTS_API_KEY"]);
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode";

  const client = new DodoPayments({
    bearerToken: apiKey,
    environment, // 'test_mode' | 'live_mode'
  });

  // Preflight: print env and validate key vs environment
  const keyPreview = apiKey.startsWith("sk_") ? apiKey.slice(0, 8) + "..." : "unknown-format";
  console.log(`[Dodo] Environment: ${environment}`);
  console.log(`[Dodo] API key preview: ${keyPreview}`);

  if (environment === "test_mode" && apiKey.startsWith("sk_live_")) {
    throw new Error("Configured environment=test_mode but API key is live. Use a sk_test_*** key or set DODO_PAYMENTS_ENVIRONMENT=live_mode.");
  }
  if (environment === "live_mode" && apiKey.startsWith("sk_test_")) {
    throw new Error("Configured environment=live_mode but API key is test. Use a sk_live_*** key or set DODO_PAYMENTS_ENVIRONMENT=test_mode.");
  }

  // Sanity auth check (helps surface 401 root cause early)
  try {
    // simple read call to verify credentials
    const page = await client.creditEntitlements.list();
    console.log(`[Dodo] Auth check OK. Existing entitlements page size: ${page.items?.length ?? "n/a"}`);
  } catch (e) {
    console.error("[Dodo] Auth check failed (likely invalid API key or role).", e?.status || "", e?.message || e);
    throw e;
  }

  // 1) Create a Credit Entitlement (1 unit = 1 screenshot)
  console.log("Creating credit entitlement: 'ScreenTool Screenshot Credits' ...");
  const creditEntitlement = await client.creditEntitlements.create({
    name: "ScreenTool Screenshot Credits",
    unit: "screenshot",
    precision: 0,
    rollover_enabled: false,
    overage_enabled: false,
    description: "1 credit = 1 screenshot. Used by subscriptions and top-ups.",
  });

  console.log("Credit Entitlement ID:", creditEntitlement.id);

  // Helpers
  async function createSubscriptionProduct({ name, priceCents, monthlyCredits, overagePricePerUnitUSD, planMeta }) {
    const product = await client.products.create({
      name,
      price: {
        type: "recurring_price",
        currency: "USD",
        price: priceCents,
        discount: 0,
        purchasing_power_parity: true,
        payment_frequency_count: 1,
        payment_frequency_interval: "Month",
        subscription_period_count: 1,
        subscription_period_interval: "Month",
        tax_inclusive: false,
      },
      tax_category: "saas",
      metadata: { plan: planMeta },
      credit_entitlements: [
        {
          credit_entitlement_id: creditEntitlement.id,
          credits_amount: String(monthlyCredits),
          rollover_enabled: false,
          low_balance_threshold_percent: 20,
          overage_enabled: true,
          currency: "USD",
          price_per_unit: String(overagePricePerUnitUSD), // decimal string e.g. "0.005"
          proration_behavior: "prorate",
        },
      ],
    });

    console.log(`Created subscription product '${name}': ${product.product_id}`);
    return product;
  }

  async function createTopupProduct({ name, priceCents, credits, expiresDays }) {
    const product = await client.products.create({
      name,
      price: {
        type: "one_time_price",
        currency: "USD",
        price: priceCents,
        discount: 0,
        purchasing_power_parity: true,
        tax_inclusive: false,
      },
      tax_category: "digital_products",
      metadata: { kind: "topup" },
      credit_entitlements: [
        {
          credit_entitlement_id: creditEntitlement.id,
          credits_amount: String(credits),
          expires_after_days: expiresDays,
          rollover_enabled: false,
          overage_enabled: false,
          low_balance_threshold_percent: 20,
        },
      ],
    });

    console.log(`Created top-up product '${name}': ${product.product_id}`);
    return product;
  }

  // 2) Create Subscription Products
  const starter = await createSubscriptionProduct({
    name: "ScreenTool Starter (Monthly)",
    priceCents: 900, // $9.00
    monthlyCredits: 2500,
    overagePricePerUnitUSD: "0.005",
    planMeta: "starter",
  });

  const pro = await createSubscriptionProduct({
    name: "ScreenTool Pro (Monthly)",
    priceCents: 4900, // $49.00
    monthlyCredits: 15000,
    overagePricePerUnitUSD: "0.003",
    planMeta: "pro",
  });

  const business = await createSubscriptionProduct({
    name: "ScreenTool Business (Monthly)",
    priceCents: 14900, // $149.00
    monthlyCredits: 50000,
    overagePricePerUnitUSD: "0.002",
    planMeta: "business",
  });

  // 3) Create Top-Up Products (365-day validity)
  const topup500 = await createTopupProduct({
    name: "ScreenTool Top-up 500",
    priceCents: 499, // $4.99
    credits: 500,
    expiresDays: 365,
  });

  const topup2500 = await createTopupProduct({
    name: "ScreenTool Top-up 2500",
    priceCents: 1999, // $19.99
    credits: 2500,
    expiresDays: 365,
  });

  const topup10000 = await createTopupProduct({
    name: "ScreenTool Top-up 10000",
    priceCents: 6999, // $69.99
    credits: 10000,
    expiresDays: 365,
  });

  // Output .env lines to paste
  console.log("\n=== Add these to your .env.local ===");
  console.log(`DODO_CREDIT_ENTITLEMENT_ID=${creditEntitlement.id}`);
  console.log(`DODO_PRODUCT_STARTER_ID=${starter.product_id}`);
  console.log(`DODO_PRODUCT_PRO_ID=${pro.product_id}`);
  console.log(`DODO_PRODUCT_BUSINESS_ID=${business.product_id}`);
  console.log(`DODO_PRODUCT_TOPUP_500_ID=${topup500.product_id}`);
  console.log(`DODO_PRODUCT_TOPUP_2500_ID=${topup2500.product_id}`);
  console.log(`DODO_PRODUCT_TOPUP_10000_ID=${topup10000.product_id}`);
}

main().catch((err) => {
  console.error("Product creation failed:", err?.message || err);
  process.exit(1);
});