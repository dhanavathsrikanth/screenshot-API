import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import DodoPayments from "dodopayments";

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

  // 1) Credit Entitlement (1 unit = 1 screenshot)
  //    Reuse an existing one (via DODO_CREDIT_ENTITLEMENT_ID or by name).
  const ENTITLEMENT_NAME = "ScreenTool Screenshot Credits";
  let creditEntitlementId = process.env.DODO_CREDIT_ENTITLEMENT_ID;
  if (!creditEntitlementId) {
    // Look up any existing entitlement with the same name to avoid 409 conflicts.
    // Note: page_number is 0-based in this API.
    let pageNumber = 0;
    let found = null;
    while (pageNumber <= 5 && !found) {
      const page = await client.creditEntitlements.list({ page_number: pageNumber, page_size: 50 });
      found = page.items?.find((e) => e.name === ENTITLEMENT_NAME) ?? null;
      pageNumber += 1;
      if (!page.items?.length) break;
    }
    if (found) creditEntitlementId = found.id;
  }
  if (creditEntitlementId) {
    console.log(`Reusing credit entitlement: ${creditEntitlementId}`);
  } else {
    console.log(`Creating credit entitlement: '${ENTITLEMENT_NAME}' ...`);
    const creditEntitlement = await client.creditEntitlements.create({
      name: ENTITLEMENT_NAME,
      unit: "screenshot",
      precision: 0,
      rollover_enabled: false,
      overage_enabled: true,
      overage_behavior: "invoice_at_billing",
      currency: "USD",
      price_per_unit: "0.005", // default per-product overage price; products override it
      description: "1 credit = 1 screenshot. Used by subscriptions and top-ups. Overage is configured per-product.",
    });
    creditEntitlementId = creditEntitlement.id;
    console.log("Credit Entitlement ID:", creditEntitlementId);
  }

  // Ensure overage is enabled on the (possibly pre-existing) entitlement so
  // product-level overage settings actually take effect.
  await client.creditEntitlements.update(creditEntitlementId, {
    overage_enabled: true,
    overage_behavior: "invoice_at_billing",
    currency: "USD",
    price_per_unit: "0.005",
  });
  console.log(`Configured overage on credit entitlement: ${creditEntitlementId}`);

  // 2) Meters — usage is deducted from the credit entitlement automatically.
  //    Both meters SUM the `units` metadata field, which the app sets to the
  //    total credits consumed (1 per screenshot, 5 per PDF page). So
  //    meter_units_per_credit = 1 and Dodo deducts exactly what we charge.
  async function getOrCreateMeter({ envName, name, eventName, measurementUnit }) {
    const existing = process.env[envName];
    if (existing) {
      console.log(`Reusing meter '${name}': ${existing}`);
      return existing;
    }
    const meter = await client.meters.create({
      name,
      event_name: eventName,
      measurement_unit: measurementUnit,
      aggregation: { type: "sum", key: "units" },
      description: `ScreenTool usage metered for credit-based billing (event: ${eventName})`,
    });
    console.log(`Created meter '${name}': ${meter.id}`);
    return meter.id;
  }

  const screenshotMeterId = await getOrCreateMeter({
    envName: "DODO_METER_SCREENSHOT_ID",
    name: "ScreenTool Screenshots",
    eventName: "screentool.screenshot",
    measurementUnit: "screenshot",
  });

  const pdfMeterId = await getOrCreateMeter({
    envName: "DODO_METER_PDF_ID",
    name: "ScreenTool PDF Pages",
    eventName: "screentool.pdf_pages",
    measurementUnit: "page",
  });

  // Helpers
  async function createSubscriptionProduct({ name, priceCents, monthlyCredits, overagePricePerUnitUSD, planMeta, frequency = "Month" }) {
    // UBB (usage-based) price so Dodo can meter consumption against the
    // credit entitlement: in-balance usage auto-deducts credits FIFO, and
    // usage past zero becomes billable overage (overage_behavior set below).
    const product = await client.products.create({
      name,
      price: {
        type: "usage_based_price",
        currency: "USD",
        fixed_price: priceCents,
        discount: 0,
        purchasing_power_parity: true,
        payment_frequency_count: 1,
        payment_frequency_interval: frequency,
        subscription_period_count: 1,
        subscription_period_interval: frequency,
        tax_inclusive: false,
        meters: [
          {
            meter_id: screenshotMeterId,
            credit_entitlement_id: creditEntitlementId,
            meter_units_per_credit: "1",
            free_threshold: 0,
            name: "ScreenTool Screenshots",
            measurement_unit: "screenshot",
          },
          {
            meter_id: pdfMeterId,
            credit_entitlement_id: creditEntitlementId,
            meter_units_per_credit: "1",
            free_threshold: 0,
            name: "ScreenTool PDF Pages",
            measurement_unit: "page",
          },
        ],
      },
      tax_category: "saas",
      metadata: { plan: planMeta },
      credit_entitlements: [
        {
          credit_entitlement_id: creditEntitlementId,
          credits_amount: String(monthlyCredits),
          rollover_enabled: false,
          low_balance_threshold_percent: 20,
          overage_enabled: true,
          overage_behavior: "invoice_at_billing",
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
          credit_entitlement_id: creditEntitlementId,
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

  // 3) Create Subscription Products (recreated as UBB with credit-billed meters)
  //    No free trials — customers are charged at checkout. Free plan never uses Dodo.
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

  // Annual variants (billed once per year; credits granted per year).
  const starterAnnual = await createSubscriptionProduct({
    name: "ScreenTool Starter (Annual)",
    priceCents: 9000, // $90.00 (~2 months free vs monthly)
    monthlyCredits: 30000, // 2,500/mo × 12
    overagePricePerUnitUSD: "0.005",
    planMeta: "starter",
    frequency: "Year",
  });

  const proAnnual = await createSubscriptionProduct({
    name: "ScreenTool Pro (Annual)",
    priceCents: 49000, // $490.00 (~2 months free vs monthly)
    monthlyCredits: 180000, // 15,000/mo × 12
    overagePricePerUnitUSD: "0.003",
    planMeta: "pro",
    frequency: "Year",
  });

  // 4) Create Top-Up Products (365-day validity)
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
  console.log(`DODO_CREDIT_ENTITLEMENT_ID=${creditEntitlementId}`);
  console.log(`DODO_METER_SCREENSHOT_ID=${screenshotMeterId}`);
  console.log(`DODO_METER_PDF_ID=${pdfMeterId}`);
  console.log(`DODO_PRODUCT_STARTER_ID=${starter.product_id}`);
  console.log(`DODO_PRODUCT_PRO_ID=${pro.product_id}`);
  console.log(`DODO_PRODUCT_STARTER_ANNUAL_ID=${starterAnnual.product_id}`);
  console.log(`DODO_PRODUCT_PRO_ANNUAL_ID=${proAnnual.product_id}`);
  console.log(`DODO_PRODUCT_TOPUP_500_ID=${topup500.product_id}`);
  console.log(`DODO_PRODUCT_TOPUP_2500_ID=${topup2500.product_id}`);
  console.log(`DODO_PRODUCT_TOPUP_10000_ID=${topup10000.product_id}`);

  console.log("\n=== IMPORTANT ===");
  console.log("Subscription products were RECREATED as usage-based (with credit-billed meters).");
  console.log("Any pre-existing ScreenTool subscription products WITHOUT meters must be archived in");
  console.log("the Dodo dashboard (or left unused) — only the NEW product IDs above grant + auto-deduct credits.");
}

main().catch((err) => {
  console.error("Product creation failed:", err?.message || err);
  process.exit(1);
});
