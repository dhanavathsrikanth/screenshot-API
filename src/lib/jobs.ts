import { createServiceClient } from "@/lib/supabase/server";
import { render } from "@/lib/browser/engine";
import { RenderError } from "@/lib/screenshot/types";
import { uploadToStorage } from "@/lib/storage/uploader";
import { artifactContentType } from "@/lib/mime";
import { getCacheKey, getFromCache, setInCache, type CacheEntry } from "@/lib/storage/cache";
import { saveScreenshot } from "@/app/actions/screenshots";
import { logScreenshotUsage } from "@/app/actions/usage";
import { computeUnits, meterUsageToDodo, refundCredits } from "@/lib/credits";
import { getUserPlan } from "@/lib/plans";
import { getFilename } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { fireWebhookEvent, jobPayload } from "@/lib/webhooks";
import { purgeExpiredScreenshots } from "@/lib/retention";
import {
  backend,
  enqueue as queueEnqueue,
  scheduleDelayed as queueScheduleDelayed,
  promoteDueDelayed,
  legacyPop,
  startWorker,
  WORKER_CONCURRENCY,
} from "@/lib/queue";
import type { ScreenshotOptions } from "@/lib/schema";

export type JobRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  api_key_id: string | null;
  request_id: string | null;
  source: string | null;
  status: string;
  queue: string;
  priority: number;
  max_attempts: number;
  request_hash: string | null;
  worker_id: string | null;
  leased_at: string | null;
  lease_expires_at: string | null;
  options: ScreenshotOptions;
  credits_charged: number;
  screenshot_id: string | null;
  storage_url: string | null;
  format: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
};

const STUCK_MID_RENDER_MS = 15 * 60 * 1000;
const STUCK_NEVER_STARTED_MS = 5 * 60 * 1000;
const REAP_INTERVAL_MS = 60 * 1000;

/** Retry backoff in ms, indexed by completed attempt count. */
const JOB_BACKOFF_MS = [5_000, 30_000, 120_000];
const MAX_JOB_ATTEMPTS = 3;

/** Errors that retrying will never fix. */
const PERMANENT_ERROR_CODES = new Set([
  "invalid_url",
  "ssrf_blocked",
  "format_not_supported",
  "job_timeout",
  "invalid_country",
  "unsupported_country",
  "geo_unavailable",
  "ffmpeg_error",
]);

const g = globalThis as unknown as {
  __v1WorkerStarted?: boolean;
  __v1Running?: number;
  __v1LastReap?: number;
  __retentionRunning?: boolean;
};

function contentType(format: string): string {
  return artifactContentType(format);
}

export function newJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Target page URL for a job's options, or undefined for html/markdown captures. */
function jobSourceUrl(options?: ScreenshotOptions): string | undefined {
  const url = options?.url;
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

export async function createJob(params: {
  id: string;
  userId: string;
  projectId?: string | null;
  apiKeyId: string | null;
  requestId?: string | null;
  source: string;
  options: ScreenshotOptions;
  creditsCharged: number;
  queue?: string;
  priority?: number;
  maxAttempts?: number;
  requestHash?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("screenshot_jobs").insert({
    id: params.id,
    user_id: params.userId,
    project_id: params.projectId ?? null,
    api_key_id: params.apiKeyId,
    request_id: params.requestId ?? null,
    source: params.source,
    status: "queued",
    queue: params.queue ?? "screenshot",
    priority: params.priority ?? 0,
    max_attempts: params.maxAttempts ?? MAX_JOB_ATTEMPTS,
    request_hash: params.requestHash ?? null,
    options: params.options,
    credits_charged: params.creditsCharged,
    attempts: 0,
  });
  if (error) {
    logger.error({ event: "job_create_failed", requestId: params.requestId ?? undefined, userId: params.userId, error: error.message });
    throw error;
  }
}

export async function getJob(id: string): Promise<JobRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("screenshot_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as JobRow;
}

// ── Queue integration (Chapter 3 Stage 3B) ────────────────────────────────
// Queue transport lives in lib/queue.ts: BullMQ when REDIS_URL is configured,
// legacy Upstash REST list/zset otherwise. The screenshot_jobs table stays the
// source of truth in both modes.

export function enqueueJob(id: string, opts?: { priority?: number }): void {
  ensureWorkerStarted();
  queueEnqueue(id, opts?.priority ?? 0);
}

/**
 * Start the job worker. Idempotent. On Render (persistent Node process) this
 * survives across requests; crashed jobs are recovered below.
 *  - bullmq: a persistent BullMQ Worker claims and processes jobs.
 *  - legacy: a polling loop over the Upstash REST queue.
 */
export function ensureWorkerStarted(): void {
  if (g.__v1WorkerStarted) return;
  g.__v1WorkerStarted = true;
  g.__v1Running = 0;

  // Runs for both backends. BullMQ's own stalled-job detection only fires
  // once a *new* worker boots after a crash/redeploy (there's no second
  // instance watching this one's heartbeat), so this reaper is the safety
  // net that guarantees a job can never be stranded in "processing" forever
  // with credits already charged and no refund/webhook.
  setTimeout(recoverStuckJobs, 1000);
  setInterval(recoverStuckJobs, REAP_INTERVAL_MS);

  // Daily retention sweep: deletes expired screenshots (R2 object + history
  // row) per the plan retention windows. First run shortly after boot.
  setTimeout(runRetentionSweep, 5 * 60 * 1000);
  setInterval(runRetentionSweep, 24 * 60 * 60 * 1000);

  if (backend() === "bullmq") {
    startWorker(
      async (jobId) => {
        const claimed = await claimJob(jobId);
        if (claimed) await processJob(jobId);
      },
      (jobId, err) => {
        void handleQueueJobFailure(jobId, err);
      }
    );
    return;
  }

  setTimeout(tick, 1000);
  setInterval(tick, 1000);
}

/**
 * Reconcile a BullMQ job that was marked "failed" without our handler ever
 * running to completion (stalled-job exhaustion after a crashed/redeployed
 * worker). No-ops if the job was already resolved normally by processJob's
 * own try/catch before the crash.
 */
async function handleQueueJobFailure(jobId: string | undefined, err: Error): Promise<void> {
  if (!jobId) return;
  try {
    const job = await getJob(jobId);
    if (!job || job.status === "completed" || job.status === "failed") return;

    const supabase = createServiceClient();
    await refundCredits(job.user_id, job.credits_charged ?? 0);
    await supabase
      .from("screenshot_jobs")
      .update({
        status: "failed",
        error_code: "worker_crashed",
        error_message: err?.message || "The job worker crashed or the job stalled beyond the retry limit.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    const updated = await getJob(jobId);
    if (updated) {
      fireWebhookEvent({
        userId: job.user_id,
        projectId: job.project_id,
        event: "screenshot.failed",
        data: jobPayload(updated).data,
      }).catch(() => {});
    }
  } catch (e) {
    logger.error({ event: "queue_failed_job_sync_error", jobId, error: e instanceof Error ? e.message : e });
  }
}

async function tick(): Promise<void> {
  try {
    await promoteDueDelayed();
  } catch (e) {
    logger.error({ event: "job_promote_error", error: e instanceof Error ? e.message : e });
  }
  while ((g.__v1Running ?? 0) < WORKER_CONCURRENCY) {
    const id = await legacyPop();
    if (!id) break;
    const claimed = await claimJob(id);
    if (!claimed) continue;
    g.__v1Running = (g.__v1Running ?? 0) + 1;
    processJob(id).finally(() => {
      g.__v1Running = Math.max(0, (g.__v1Running ?? 1) - 1);
    });
  }
}

/**
 * Claim a job atomically so two instances never render the same job. Returns
 * false when the job was already completed/claimed elsewhere.
 */
async function claimJob(id: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("screenshot_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .in("status", ["queued", "processing"])
    .eq("id", id)
    .select("id");
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

async function recoverStuckJobs(): Promise<void> {
  try {
    const now = Date.now();
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("screenshot_jobs")
      .select("id, status, priority, user_id, project_id, credits_charged, created_at, started_at, next_attempt_at")
      .in("status", ["processing", "queued"]);

    for (const job of data ?? []) {
      // Jobs scheduled for retry whose delayed entry was lost (e.g. Redis
      // flushed) are re-enqueued from the DB when their time has passed.
      if (job.status === "queued") {
        const nextAt = job.next_attempt_at ? new Date(job.next_attempt_at).getTime() : null;
        if (nextAt === null || nextAt <= now) {
          queueEnqueue(job.id, job.priority ?? 0);
          await supabase
            .from("screenshot_jobs")
            .update({ next_attempt_at: new Date(Date.now() + 30_000).toISOString() })
            .eq("id", job.id);
        }
        continue;
      }

      const started = job.started_at ? new Date(job.started_at).getTime() : null;
      const created = new Date(job.created_at).getTime();
      const isStuck = started
        ? now - started > STUCK_MID_RENDER_MS
        : now - created > STUCK_NEVER_STARTED_MS;
      if (!isStuck) continue;

      await refundCredits(job.user_id, job.credits_charged ?? 0);
      await supabase
        .from("screenshot_jobs")
        .update({
          status: "failed",
          error_code: "job_timeout",
          error_message: "Job did not complete in time.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      const updated = await getJob(job.id);
      if (updated) {
        fireWebhookEvent({
          userId: job.user_id,
          projectId: job.project_id,
          event: "screenshot.failed",
          data: jobPayload(updated).data,
        }).catch(() => {});
      }
    }
  } catch (e) {
    logger.error({ event: "job_recovery_failed", error: e instanceof Error ? e.message : e });
  }
}

async function runRetentionSweep(): Promise<void> {
  if (g.__retentionRunning) return;
  g.__retentionRunning = true;
  try {
    const { deleted } = await purgeExpiredScreenshots();
    if (deleted > 0) {
      logger.info({ event: "retention_purge_completed", deleted });
    }
  } catch (e) {
    logger.error({ event: "retention_purge_failed", error: e instanceof Error ? e.message : e });
  } finally {
    g.__retentionRunning = false;
  }
}

/**
 * Render a single job: claim → render → upload to R2 → save a screenshot
 * row → mark completed. Transient failures retry with exponential backoff
 * (durable via Redis + screenshot_jobs). Permanent failures refund credits
 * and mark the job failed. Serves cache hits straight from R2 (no render).
 */
export async function processJob(id: string): Promise<void> {
  const startedAt = Date.now();
  const supabase = createServiceClient();

  const job = await getJob(id);
  if (!job || (job.status !== "processing" && job.status !== "queued")) return;

  // Notify subscribers once, when the job first starts processing (not on retries).
  if ((job.attempts ?? 0) === 0) {
    fireWebhookEvent({
      userId: job.user_id,
      projectId: job.project_id,
      event: "job.started",
      data: {
        id: job.id,
        status: "processing",
        status_url: `/api/v1/screenshots/${job.id}`,
        created_at: job.created_at,
      },
    }).catch(() => {});
  }

  const common = {
    userId: job.user_id,
    projectId: job.project_id,
    apiKeyId: job.api_key_id ?? undefined,
    requestId: job.request_id,
  };

  try {
    // ── Cache first: a hit completes instantly with the R2 URL ─────────
    const cacheKey = getCacheKey(job.options as unknown as Record<string, unknown>);
    const cached = await getFromCache(cacheKey);
    if (cached) {
      await completeJob(id, cached.storageUrl, cached.format, cached.width, cached.height, cached.sizeBytes, cached, common, startedAt, jobSourceUrl(job.options));
      return;
    }

    const result = await render(job.options);

    const key = uniqueKey(typeof job.options?.url === "string" ? job.options.url : "screenshot", result.format);
    let publicUrl: string | null = null;
    try {
      publicUrl = await uploadToStorage(result.buffer, key, contentType(result.format));
    } catch (e) {
      logger.error({ event: "render_upload_failed", jobId: id, requestId: job.request_id ?? undefined, error: e instanceof Error ? e.message : e });
    }

    if (publicUrl) {
      const plan = await getUserPlan(job.user_id);
      setInCache(
        cacheKey,
        {
          storageUrl: publicUrl,
          width: result.width,
          height: result.height,
          format: result.format,
          sizeBytes: result.buffer.length,
        },
        plan
      ).catch(() => {});
    }

    await completeJob(id, publicUrl, result.format, result.width, result.height, result.buffer.length, null, common, startedAt, jobSourceUrl(job.options));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown render error";
    const code =
      e instanceof RenderError ? e.code : "render_failed";
    const attempts = (job.attempts ?? 0) + 1;
    const retriable = attempts < (job.max_attempts ?? MAX_JOB_ATTEMPTS) && !PERMANENT_ERROR_CODES.has(code);

    if (retriable) {
      const backoffMs = JOB_BACKOFF_MS[attempts - 1] ?? 120_000;
      const nextAt = new Date(Date.now() + backoffMs).toISOString();
      logger.error({ event: "job_retry_scheduled", jobId: id, requestId: job.request_id ?? undefined, userId: job.user_id, errorCode: code, error: message, attempt: attempts });
      await supabase
        .from("screenshot_jobs")
        .update({
          status: "queued",
          attempts,
          last_error: message,
          error_code: code,
          next_attempt_at: nextAt,
        })
        .eq("id", id);
      queueScheduleDelayed(id, Date.now() + backoffMs, job.priority ?? 0);
      return;
    }

    logger.error({ event: "job_failed", jobId: id, requestId: job.request_id ?? undefined, userId: job.user_id, errorCode: code, error: message });
    await refundCredits(job.user_id, job.credits_charged ?? 0);
    await supabase
      .from("screenshot_jobs")
      .update({
        status: "failed",
        error_code: code,
        error_message: message,
        attempts,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);

    const updated = await getJob(id);
    if (updated) {
      fireWebhookEvent({
        userId: job.user_id,
        projectId: job.project_id,
        event: "screenshot.failed",
        data: jobPayload(updated).data,
      }).catch(() => {});
    }
  }
}

async function completeJob(
  id: string,
  storageUrl: string | null,
  format: string,
  width: number,
  height: number,
  sizeBytes: number,
  cachedEntry: { storageUrl: string; width: number; height: number; format: string; sizeBytes: number } | null,
  common: { userId: string; projectId: string | null; apiKeyId?: string; requestId?: string | null },
  startedAt: number,
  sourceUrl?: string
): Promise<void> {
  const supabase = createServiceClient();

  let screenshotId: string | null = null;
  try {
    const saved = await saveScreenshot({
      userId: common.userId,
      projectId: common.projectId,
      apiKeyId: common.apiKeyId,
      sourceUrl,
      storageUrl: storageUrl ?? cachedEntry?.storageUrl ?? null,
      format,
      width,
      height,
      fileSizeBytes: sizeBytes,
      cached: cachedEntry !== null,
      metadata: {
        source: "api",
        endpoint: "/api/v1/screenshots",
        method: "POST",
        request_id: common.requestId,
        credits_used: cachedEntry !== null ? 0 : undefined,
        response_time_ms: Date.now() - startedAt,
      },
    });
    screenshotId = saved.id;
  } catch (e) {
    logger.error({ event: "job_save_screenshot_failed", jobId: id, requestId: common.requestId ?? undefined, error: e instanceof Error ? e.message : e });
  }

  await supabase
    .from("screenshot_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      storage_url: storageUrl ?? cachedEntry?.storageUrl ?? null,
      format,
      width,
      height,
      size_bytes: sizeBytes,
      screenshot_id: screenshotId,
    })
    .eq("id", id);

  const updated = await getJob(id);
  if (updated) {
    fireWebhookEvent({
      userId: common.userId,
      projectId: common.projectId,
      event: "screenshot.completed",
      data: jobPayload(updated).data,
    }).catch(() => {});

    // Meter to Dodo only now that the render succeeded — intake defers
    // metering (meter: false) so failed jobs are never billed on either the
    // local balance (refundCredits) or the Dodo side.
    const { kind } = computeUnits({
      cached: cachedEntry !== null,
      format,
      pdfPages: updated.options?.pdfPages,
      videoSeconds: updated.options?.video_seconds,
      geoTargeted: Boolean(updated.options?.country),
    });
    meterUsageToDodo(common.userId, updated.credits_charged ?? 0, kind, {
      endpoint: "/api/v1/screenshots",
      method: "POST",
      request_id: common.requestId ?? undefined,
      ...(updated.options?.country ? { country: updated.options.country } : {}),
    }).catch(() => {});
  }

  logScreenshotUsage({
    userId: common.userId,
    projectId: common.projectId,
    apiKeyId: common.apiKeyId,
    requestId: common.requestId,
    endpoint: "/api/v1/screenshots",
    method: "POST",
    statusCode: 200,
    screenshotUrl: storageUrl ?? cachedEntry?.storageUrl ?? null,
    cached: cachedEntry !== null,
    responseTimeMs: Date.now() - startedAt,
    creditsUsed: 0,
    source: "api",
  }).catch(() => {});
}

/**
 * Persist a v1 cache hit as a real completed job + screenshot row so the
 * returned ID is fetchable via /v1/screenshots/[id], shows up in listings,
 * and lands in dashboard history. Best-effort: if persistence fails the hit
 * is still served (with an unfetchable ID) rather than erroring.
 */
export async function recordCacheHitJob(params: {
  userId: string;
  projectId?: string | null;
  apiKeyId?: string | null;
  requestId?: string | null;
  source: string;
  options: ScreenshotOptions;
  requestHash: string;
  creditsCharged: number;
  priority?: number;
  entry: CacheEntry;
  responseTimeMs?: number;
}): Promise<{ id: string; screenshotId: string | null; completedAt: string }> {
  const id = newJobId();
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  let screenshotId: string | null = null;
  try {
    const saved = await saveScreenshot({
      userId: params.userId,
      projectId: params.projectId,
      apiKeyId: params.apiKeyId ?? undefined,
      sourceUrl: jobSourceUrl(params.options),
      storageUrl: params.entry.storageUrl,
      format: params.entry.format,
      width: params.entry.width,
      height: params.entry.height,
      fileSizeBytes: params.entry.sizeBytes,
      cached: true,
      metadata: {
        source: "api",
        endpoint: "/api/v1/screenshots",
        method: "POST",
        request_id: params.requestId,
        cached: true,
        response_time_ms: params.responseTimeMs ?? 0,
      },
    });
    screenshotId = saved.id;
  } catch (e) {
    logger.error({ event: "cache_hit_save_screenshot_failed", requestId: params.requestId ?? undefined, userId: params.userId, error: e instanceof Error ? e.message : e });
  }

  const { error } = await supabase.from("screenshot_jobs").insert({
    id,
    user_id: params.userId,
    project_id: params.projectId ?? null,
    api_key_id: params.apiKeyId,
    request_id: params.requestId ?? null,
    source: params.source,
    status: "completed",
    queue: "screenshot",
    priority: params.priority ?? 0,
    max_attempts: MAX_JOB_ATTEMPTS,
    request_hash: params.requestHash,
    options: params.options,
    credits_charged: params.creditsCharged,
    attempts: 0,
    started_at: now,
    completed_at: now,
    storage_url: params.entry.storageUrl,
    format: params.entry.format,
    width: params.entry.width,
    height: params.entry.height,
    size_bytes: params.entry.sizeBytes,
    screenshot_id: screenshotId,
  });
  if (error) {
    logger.error({ event: "cache_hit_job_record_failed", requestId: params.requestId ?? undefined, userId: params.userId, error: error.message });
  }

  return { id, screenshotId, completedAt: now };
}

function uniqueKey(url: string, format: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}_${rand}_${getFilename(url, format)}`;
}
