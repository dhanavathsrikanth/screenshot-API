import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/api-auth";
import { getJob } from "@/lib/jobs";
import { deleteStorageObjectByUrl } from "@/lib/storage/fallback";
import { createServiceClient } from "@/lib/supabase/server";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";

export const maxDuration = 60;

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const { id } = await ctx.params;

    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }

    const job = await getJob(id);
    if (!job || job.user_id !== authCtx.userId) {
      return v1Err(404, "not_found", "Screenshot job not found.", requestId);
    }

    return v1Ok({
      id: job.id,
      status: job.status,
      queue: job.queue,
      priority: job.priority,
      attempts: job.attempts,
      max_attempts: job.max_attempts,
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const { id } = await ctx.params;

    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }

    const job = await getJob(id);
    if (!job || job.user_id !== authCtx.userId) {
      return v1Err(404, "not_found", "Screenshot job not found.", requestId);
    }

    const supabase = createServiceClient();

    const storageUrl = job.storage_url;
    if (storageUrl) {
      deleteStorageObjectByUrl(storageUrl).catch((e) =>
        console.error("[v1] storage delete failed:", e instanceof Error ? e.message : e)
      );
    }
    if (job.screenshot_id) {
      await supabase.from("screenshots").delete().eq("id", job.screenshot_id);
    }
    await supabase.from("screenshot_jobs").delete().eq("id", job.id);

    return v1Ok({ id: job.id, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
