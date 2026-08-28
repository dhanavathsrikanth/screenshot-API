import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

/**
 * Chapter 3 Stage 3B: priority-aware job queue.
 *
 * BullMQ is used when a RESP Redis connection is configured via REDIS_URL
 * (e.g. Render Key Value / Valkey). Upstash's REST API cannot drive BullMQ,
 * so when REDIS_URL is unset we fall back to the legacy list/zset queue over
 * the Upstash REST client — local dev and pre-BullMQ deploys keep working
 * unchanged. The screenshot_jobs table stays the source of truth in both
 * modes; this module is only the transport (ordering, priority, delaying).
 */

const QUEUE_NAME = "screenshot";

/** Safe number of browser jobs a single worker process runs concurrently. */
export const WORKER_CONCURRENCY = 2;

const RESP_URL = (process.env.REDIS_URL ?? process.env.QUEUE_REDIS_URL ?? "").trim();

const g = globalThis as unknown as {
  __queueConnection?: IORedis;
  __queueInstance?: Queue;
  __queueWorker?: Worker;
  __legacyQueue?: string[];
};

/** BullMQ uses lower numbers for higher priority — invert the DB priority. */
function toBullPriority(dbPriority: number): number {
  return Math.max(1, 100 - (dbPriority ?? 0));
}

export function backend(): "bullmq" | "legacy" {
  return RESP_URL ? "bullmq" : "legacy";
}

function connection(): IORedis {
  if (!g.__queueConnection) {
    g.__queueConnection = new IORedis(RESP_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      connectTimeout: 10_000,
    });
  }
  return g.__queueConnection;
}

function getQueue(): Queue {
  if (!g.__queueInstance) {
    g.__queueInstance = new Queue(QUEUE_NAME, {
      connection: connection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
  }
  return g.__queueInstance;
}

function addBullJob(jobId: string, priority: number, delayMs?: number): void {
  const queue = getQueue();
  queue
    .add(
      QUEUE_NAME,
      { jobId },
      {
        // BullMQ job ids need not match the DB job id; the DB job id rides
        // in the payload. A unique id per add avoids resurrecting old jobs.
        jobId: `${jobId}:${Date.now()}`,
        priority: toBullPriority(priority),
        ...(delayMs && delayMs > 0 ? { delay: delayMs } : {}),
      }
    )
    .catch((err) => {
      // The job row already exists as 'queued'; recoverStuckJobs re-enqueues
      // it from the DB, so a transient queue write failure is self-healing.
      logger.error({ event: "queue_enqueue_failed", jobId, error: err instanceof Error ? err.message : err });
    });
}

export function enqueue(jobId: string, priority = 0): void {
  if (backend() === "bullmq") {
    addBullJob(jobId, priority);
    return;
  }
  void legacyPush(jobId);
}

/** Re-deliver a job after a retry backoff. No-op in-process bookkeeping. */
export function scheduleDelayed(jobId: string, atMs: number, priority = 0): void {
  const delayMs = Math.max(0, atMs - Date.now());
  if (backend() === "bullmq") {
    addBullJob(jobId, priority, delayMs);
    return;
  }
  legacyScheduleDelayed(jobId, atMs);
}

/**
 * Start the queue consumer. In BullMQ mode this creates a persistent Worker;
 * in legacy mode the caller drives the loop via promoteDueDelayed/legacyPop.
 */
export function startWorker(
  handler: (jobId: string) => Promise<void>,
  onFailed?: (jobId: string | undefined, err: Error) => void
): void {
  if (backend() !== "bullmq") {
    throw new Error("startWorker is only valid with the bullmq backend");
  }
  if (g.__queueWorker) return;
  g.__queueWorker = new Worker(
    QUEUE_NAME,
    async (job: Job<{ jobId: string }>) => {
      await handler(job.data.jobId);
    },
    {
      connection: connection(),
      concurrency: WORKER_CONCURRENCY,
    }
  );
  g.__queueWorker.on("failed", (job, err) => {
    logger.error({ event: "queue_job_failed", jobId: job?.data?.jobId, error: err?.message ?? err });
    // BullMQ marks a job "failed" both on a handler throwing AND when a
    // stalled job (e.g. the worker process crashed/redeployed mid-render)
    // exhausts its retry budget — in the latter case our handler above never
    // ran to completion, so the DB row and credits were never reconciled.
    // `onFailed` lets the caller (jobs.ts) sync screenshot_jobs + refund
    // credits for exactly that case.
    onFailed?.(job?.data?.jobId, err);
  });
  g.__queueWorker.on("error", (err) => {
    logger.error({ event: "queue_worker_error", error: err?.message ?? err });
  });
}

// ── Legacy backend (Upstash REST list/zset, in-process fallback) ───────

async function legacyPush(jobId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.lpush("jobs:ready", jobId);
      return;
    } catch {
      // fall through to in-process
    }
  }
  g.__legacyQueue ??= [];
  g.__legacyQueue.push(jobId);
}

export async function legacyPop(): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.rpop("jobs:ready");
    } catch {
      // fall through to in-process
    }
  }
  return g.__legacyQueue?.shift() ?? null;
}

function legacyScheduleDelayed(jobId: string, atMs: number): void {
  const redis = getRedis();
  if (redis) {
    try {
      void redis.zadd("jobs:delayed", { score: atMs, member: jobId });
      return;
    } catch {
      // fall through
    }
  }
  const delayMs = Math.max(0, atMs - Date.now());
  setTimeout(() => {
    if (!getRedis()) {
      g.__legacyQueue ??= [];
      g.__legacyQueue.push(jobId);
    }
  }, delayMs);
}

/** Move delayed jobs whose time has come back onto the ready queue. */
export async function promoteDueDelayed(): Promise<void> {
  const redis = getRedis();
  if (!redis || backend() === "bullmq") return;
  try {
    const due = await redis.zrange("jobs:delayed", 0, Date.now(), {
      byScore: true,
      offset: 0,
      count: 50,
    });
    if (!due || due.length === 0) return;
    const pipe = redis.pipeline();
    for (const id of due) {
      pipe.zrem("jobs:delayed", id);
      pipe.lpush("jobs:ready", id);
    }
    await pipe.exec();
  } catch (e) {
    logger.error({ event: "queue_promote_failed", error: e instanceof Error ? e.message : e });
  }
}
