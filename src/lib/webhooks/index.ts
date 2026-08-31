import { createHmac } from "crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { validateTargetUrl, SsrfError } from "@/lib/security/ssrf";
import type { JobRow } from "@/lib/jobs";

/**
 * Outbound webhook delivery.
 *
 * Events are written to webhook_deliveries and delivered by an in-process
 * worker (webhook deliveries live in Postgres, so they survive restarts and
 * are picked up by whichever instance sweeps them). Deliveries are signed
 * with an HMAC-SHA256 secret unique per endpoint; the `x-webhook-signature`
 * header carries `t=<unix_ms>,v1=<hex>` so receivers can verify authenticity
 * and freshness.
 */

export const WEBHOOK_EVENTS = [
  "screenshot.completed",
  "screenshot.failed",
  "job.started",
  "quota.exceeded",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Event used for dashboard/API test sends; never subscribable. */
export const WEBHOOK_TEST_EVENT = "webhook.test";

/**
 * Webhook targets are server-initiated POSTs, so they must not be able to
 * reach internal infrastructure. Enforce HTTPS + public DNS resolution
 * (same SSRF guard as render targets) at creation/update time.
 */
export async function assertValidWebhookUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Webhook URL must be a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS.");
  }
  try {
    await validateTargetUrl(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      throw new Error("Webhook URL must point to a publicly reachable address.");
    }
    throw err;
  }
}

const WEBHOOK_USER_AGENT = "webcapture-webhooks/1.0";
const DELIVERY_TIMEOUT_MS = 10_000;
const CLAIM_BATCH = 20;
const MAX_CONCURRENCY = 5;
const STUCK_DELIVERING_MS = 60_000;
const SWEEP_INTERVAL_MS = 5_000;
const STUCK_SWEEP_INTERVAL_MS = 60_000;

/** Retry backoff in ms, indexed by completed attempt count (attempt 0 → first retry delay). */
const RETRY_BACKOFF_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000];

export type WebhookEndpointRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WebhookDeliveryRow = {
  id: string;
  endpoint_id: string;
  user_id: string;
  event: string;
  payload: Record<string, unknown>;
  signature: string | null;
  status: "pending" | "delivering" | "succeeded" | "failed";
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  http_status: number | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
};

export function newWebhookSecret(): string {
  return `whsec_${nanoid(32)}`;
}

export const WebhookEndpointCreateSchema = z.object({
  url: z.string().url("Must be a valid URL.").max(2048),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, "Subscribe to at least one event.")
    .default([...WEBHOOK_EVENTS]),
});

export const WebhookEndpointUpdateSchema = z.object({
  url: z.string().url("Must be a valid URL.").max(2048).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  is_active: z.boolean().optional(),
  rotate_secret: z.boolean().optional(),
});

export type WebhookEndpointCreate = z.infer<typeof WebhookEndpointCreateSchema>;
export type WebhookEndpointUpdate = z.infer<typeof WebhookEndpointUpdateSchema>;

export function signWebhook(secret: string, body: string): string {
  const timestamp = Date.now();
  const hex = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${hex}`;
}

// ── Endpoint management ──────────────────────────────────────────────────────

export async function listEndpoints(userId: string): Promise<WebhookEndpointRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WebhookEndpointRow[];
}

export async function createEndpoint(params: {
  userId: string;
  projectId?: string | null;
  url: string;
  events: string[];
}): Promise<{ endpoint: WebhookEndpointRow; secret: string }> {
  await assertValidWebhookUrl(params.url);
  const supabase = createServiceClient();
  const secret = newWebhookSecret();
  const { data, error } = await supabase
    .from("webhook_endpoints")
    .insert({
      user_id: params.userId,
      project_id: params.projectId ?? null,
      url: params.url,
      events: params.events,
      secret,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { endpoint: data as WebhookEndpointRow, secret };
}

export async function updateEndpoint(params: {
  id: string;
  userId: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
  rotateSecret?: boolean;
}): Promise<{ endpoint: WebhookEndpointRow; secret?: string }> {
  if (params.url !== undefined) await assertValidWebhookUrl(params.url);
  const supabase = createServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.url !== undefined) patch.url = params.url;
  if (params.events !== undefined) patch.events = params.events;
  if (params.isActive !== undefined) patch.is_active = params.isActive;
  if (params.rotateSecret) patch.secret = newWebhookSecret();

  const { data, error } = await supabase
    .from("webhook_endpoints")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", params.userId)
    .select("*")
    .single();
  if (error) throw error;
  const endpoint = data as WebhookEndpointRow;
  return { endpoint, ...(params.rotateSecret ? { secret: endpoint.secret } : {}) };
}

export async function deleteEndpoint(id: string, userId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("webhook_deliveries").delete().eq("endpoint_id", id).eq("user_id", userId);
  const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function listDeliveries(userId: string, endpointId?: string, limit = 50) {
  const supabase = createServiceClient();
  let query = supabase
    .from("webhook_deliveries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (endpointId) query = query.eq("endpoint_id", endpointId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WebhookDeliveryRow[];
}

// ── Event firing ─────────────────────────────────────────────────────────────

export function jobPayload(job: JobRow): { event: WebhookEvent; data: Record<string, unknown> } {
  const event: WebhookEvent = job.status === "completed" ? "screenshot.completed" : "screenshot.failed";
  return {
    event,
    data: {
      id: job.id,
      status: job.status,
      status_url: `/api/v1/screenshots/${job.id}`,
      screenshot:
        job.status === "completed"
          ? {
              id: job.screenshot_id,
              url: job.storage_url,
              format: job.format,
              width: job.width,
              height: job.height,
              size: job.size_bytes,
              created_at: job.completed_at,
            }
          : null,
      error:
        job.status === "failed"
          ? { code: job.error_code, message: job.error_message }
          : null,
      created_at: job.created_at,
      updated_at: job.completed_at ?? job.started_at ?? job.created_at,
    },
  };
}

/**
 * Enqueue a delivery for every active endpoint subscribed to the event.
 * Best-effort: failures here must never break the job pipeline.
 */
export async function fireWebhookEvent(params: {
  userId: string;
  projectId?: string | null;
  event: WebhookEvent;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: endpoints } = await supabase
      .from("webhook_endpoints")
      .select("id, user_id, events, project_id")
      .eq("user_id", params.userId)
      .eq("is_active", true)
      .contains("events", [params.event]);

    const scoped = (endpoints ?? []).filter(
      (e) =>
        e.project_id === null ||
        (params.projectId != null && e.project_id === params.projectId)
    );

    if (scoped.length === 0) return;

    const payload: Record<string, unknown> = {
      event: params.event,
      created_at: new Date().toISOString(),
      data: params.data,
    };

    const rows = scoped.map((e) => ({
      endpoint_id: e.id,
      user_id: params.userId,
      event: params.event,
      payload,
      status: "pending",
      attempts: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("webhook_deliveries").insert(rows);
    if (error) {
      logger.error({ event: "webhook_enqueue_failed", userId: params.userId, webhookEvent: params.event, error: error.message });
      return;
    }
    ensureWebhookWorkerStarted();
  } catch (e) {
    logger.error({ event: "webhook_enqueue_error", userId: params.userId, webhookEvent: params.event, error: e instanceof Error ? e.message : e });
  }
}

// ── Test sends + replays ─────────────────────────────────────────────────────

/**
 * Enqueue a signed test delivery to an endpoint, bypassing its event
 * subscriptions. Returns the delivery id so callers can poll for status.
 */
export async function testEndpointDelivery(
  userId: string,
  endpointId: string
): Promise<string> {
  const supabase = createServiceClient();
  const { data: endpoint } = await supabase
    .from("webhook_endpoints")
    .select("id")
    .eq("id", endpointId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!endpoint) throw new Error("Webhook endpoint not found.");

  const payload: Record<string, unknown> = {
    event: WEBHOOK_TEST_EVENT,
    created_at: new Date().toISOString(),
    data: {
      message: "This is a test delivery from your webhook settings.",
      endpoint_id: endpointId,
      timestamp: new Date().toISOString(),
    },
  };

  const { data, error } = await supabase
    .from("webhook_deliveries")
    .insert({
      endpoint_id: endpointId,
      user_id: userId,
      event: WEBHOOK_TEST_EVENT,
      payload,
      status: "pending",
      attempts: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;

  ensureWebhookWorkerStarted();
  return data.id;
}

/**
 * Re-queue an existing delivery from the top (attempts reset). The original
 * payload and signature are preserved.
 */
export async function replayDelivery(
  userId: string,
  deliveryId: string
): Promise<void> {
  const supabase = createServiceClient();
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .select("id, status")
    .eq("id", deliveryId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!delivery) throw new Error("Delivery not found.");
  if (delivery.status === "delivering") {
    throw new Error("Delivery is currently in flight; try again in a moment.");
  }

  const { error } = await supabase
    .from("webhook_deliveries")
    .update({
      status: "pending",
      attempts: 0,
      http_status: null,
      error: null,
      sent_at: null,
      next_retry_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .eq("user_id", userId);
  if (error) throw error;

  ensureWebhookWorkerStarted();
}

// ── Delivery worker ──────────────────────────────────────────────────────────

const g = globalThis as unknown as {
  __webhookWorkerStarted?: boolean;
  __webhookRunning?: number;
};

export function ensureWebhookWorkerStarted(): void {
  if (g.__webhookWorkerStarted) return;
  g.__webhookWorkerStarted = true;
  g.__webhookRunning = 0;
  setTimeout(() => {
    tickDeliveries();
    reclaimStuckDeliveries();
  }, 1_000);
  setInterval(tickDeliveries, SWEEP_INTERVAL_MS);
  setInterval(reclaimStuckDeliveries, STUCK_SWEEP_INTERVAL_MS);
}

async function tickDeliveries(): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { data: due } = await supabase
      .from("webhook_deliveries")
      .select("*")
      .eq("status", "pending")
      .lte("next_retry_at", new Date().toISOString())
      .order("next_retry_at", { ascending: true })
      .limit(CLAIM_BATCH);

    for (const row of due ?? []) {
      if ((g.__webhookRunning ?? 0) >= MAX_CONCURRENCY) return;
      const { data } = await supabase
        .from("webhook_deliveries")
        .update({ status: "delivering" })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id");
      if (!data || data.length === 0) continue;

      g.__webhookRunning = (g.__webhookRunning ?? 0) + 1;
      deliverWebhook(row as WebhookDeliveryRow).finally(() => {
        g.__webhookRunning = Math.max(0, (g.__webhookRunning ?? 1) - 1);
      });
    }
  } catch (e) {
    logger.error({ event: "webhook_sweep_failed", error: e instanceof Error ? e.message : e });
  }
}

async function reclaimStuckDeliveries(): Promise<void> {
  try {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - STUCK_DELIVERING_MS).toISOString();
    const { data: stuck } = await supabase
      .from("webhook_deliveries")
      .select("id")
      .eq("status", "delivering")
      .lt("created_at", cutoff);
    for (const row of stuck ?? []) {
      await supabase
        .from("webhook_deliveries")
        .update({ status: "pending", next_retry_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "delivering");
    }
  } catch (e) {
    logger.error({ event: "webhook_reclaim_failed", error: e instanceof Error ? e.message : e });
  }
}

async function deliverWebhook(row: WebhookDeliveryRow): Promise<void> {
  const supabase = createServiceClient();
  const { data: endpoint } = await supabase
    .from("webhook_endpoints")
    .select("*")
    .eq("id", row.endpoint_id)
    .maybeSingle();

  if (!endpoint || !endpoint.is_active) {
    await finishDelivery(row, { status: "failed", error: "Endpoint inactive or missing.", httpStatus: null });
    return;
  }

  const body = JSON.stringify(row.payload);
  const signature = signWebhook(endpoint.secret, body);

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": WEBHOOK_USER_AGENT,
        "x-webhook-id": row.id,
        "x-webhook-event": row.event,
        "x-webhook-delivery": row.id,
        "x-webhook-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });

    const ok = res.status >= 200 && res.status < 300;
    if (ok) {
      await finishDelivery(row, { status: "succeeded", httpStatus: res.status });
      return;
    }

    const attempts = row.attempts + 1;
    if (attempts >= row.max_attempts) {
      await finishDelivery(row, {
        status: "failed",
        httpStatus: res.status,
        error: `Received HTTP ${res.status} after ${row.max_attempts} attempts.`,
      });
    } else {
      const nextRetryAt = new Date(Date.now() + (RETRY_BACKOFF_MS[attempts - 1] ?? 60_000)).toISOString();
      await supabase
        .from("webhook_deliveries")
        .update({ status: "pending", attempts, signature, next_retry_at: nextRetryAt, http_status: res.status })
        .eq("id", row.id);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown delivery error";
    const attempts = row.attempts + 1;
    if (attempts >= row.max_attempts) {
      await finishDelivery(row, { status: "failed", httpStatus: null, error: message });
    } else {
      const nextRetryAt = new Date(Date.now() + (RETRY_BACKOFF_MS[attempts - 1] ?? 60_000)).toISOString();
      await supabase
        .from("webhook_deliveries")
        .update({ status: "pending", attempts, signature, next_retry_at: nextRetryAt, error: message })
        .eq("id", row.id);
    }
  }
}

async function finishDelivery(
  row: WebhookDeliveryRow,
  patch: { status: "succeeded" | "failed"; httpStatus: number | null; error?: string }
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("webhook_deliveries")
    .update({
      status: patch.status,
      http_status: patch.httpStatus,
      error: patch.error ?? null,
      sent_at: new Date().toISOString(),
    })
    .eq("id", row.id);
}
