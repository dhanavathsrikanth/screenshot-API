import { CustomerPortal } from "@dodopayments/nextjs";
import { getDodoConfig } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cfg = getDodoConfig();

export const GET = CustomerPortal({
  bearerToken: cfg.apiKey,
  environment: cfg.environment as "test_mode" | "live_mode",
});