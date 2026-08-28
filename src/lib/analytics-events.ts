import { createServiceClient } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/posthog";

const TENTH_SCREENSHOT_AT = 10;

/**
 * Activation + milestone tracking for the funnel (blueprint §16).
 *
 * Fires exactly-once events after a successful, non-cached render has been
 * logged so the counters reflect the true stored totals. All lookups are
 * best-effort and never block the request path.
 */
export async function trackRenderMilestones(params: {
  userId: string;
  endpoint: string;
  format?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  try {
    const [allResult, renderResult] = await Promise.all([
      supabase
        .from("api_key_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", params.userId),
      supabase
        .from("api_key_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", params.userId)
        .eq("cached", false)
        .eq("status_code", 200),
    ]);

    const totalRequests = allResult.count ?? 0;
    const totalRenders = renderResult.count ?? 0;

    if (totalRequests === 1) {
      await trackServerEvent({
        userId: params.userId,
        event: "first_api_request",
        properties: { endpoint: params.endpoint },
      });
    }
    if (totalRenders === 1) {
      await trackServerEvent({
        userId: params.userId,
        event: "first_screenshot_completed",
        properties: { format: params.format ?? null },
      });
    }
    if (totalRenders === TENTH_SCREENSHOT_AT) {
      await trackServerEvent({
        userId: params.userId,
        event: "10th_screenshot",
        properties: { format: params.format ?? null },
      });
    }
  } catch {
    // Analytics must never break a render.
  }
}

/** Fired whenever a request is rejected because the account is out of quota. */
export async function trackQuotaReached(userId: string, reason: string): Promise<void> {
  try {
    await trackServerEvent({ userId, event: "quota_reached", properties: { reason } });
  } catch {
    // best-effort
  }
}
