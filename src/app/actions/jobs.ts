"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createJob, enqueueJob, newJobId } from "@/lib/jobs";
import { ensureCredits } from "@/lib/credits";
import { getUserPlan, getQueuePriority } from "@/lib/plans";
import { getCacheKey } from "@/lib/storage/cache";
import { ScreenshotOptionsSchema, type ScreenshotOptions } from "@/lib/schema";
import { trackServerEvent } from "@/lib/posthog";

/**
 * Re-run the render that produced a screenshot. Reuses the original job's
 * full render options (viewport, format, selector, …). For screenshots that
 * predate the job pipeline, falls back to the stored URL + format.
 */
export async function retryScreenshot(screenshotId: string): Promise<{ jobId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();

  const { data: job } = await supabase
    .from("screenshot_jobs")
    .select("id, project_id, api_key_id, options")
    .eq("screenshot_id", screenshotId)
    .eq("user_id", userId)
    .maybeSingle();

  let options: ScreenshotOptions;
  let projectId: string | null = null;
  let apiKeyId: string | null = null;

  if (job?.options) {
    options = ScreenshotOptionsSchema.parse(job.options);
    projectId = job.project_id;
    apiKeyId = job.api_key_id;
  } else {
    const { data: shot } = await supabase
      .from("screenshots")
      .select("url, format, project_id, api_key_id")
      .eq("id", screenshotId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!shot) throw new Error("Screenshot not found.");
    options = ScreenshotOptionsSchema.parse({ url: shot.url ?? undefined, format: shot.format });
    projectId = shot.project_id;
    apiKeyId = shot.api_key_id;
  }

  const ensure = await ensureCredits(userId, {
    cached: false,
    format: options.format,
    pdfPages: options.pdfPages,
    meterMetadata: { endpoint: "/dashboard/history/retry", method: "POST" },
  });
  if (!ensure.allowed) {
    throw new Error("No credits remaining. Upgrade or buy credits from the dashboard.");
  }

  const id = newJobId();
  const plan = await getUserPlan(userId);
  const priority = getQueuePriority(plan);
  await createJob({
    id,
    userId,
    projectId,
    apiKeyId,
    requestId: null,
    source: "app",
    options,
    creditsCharged: ensure.units,
    priority,
    requestHash: getCacheKey(options as unknown as Record<string, unknown>),
  });
  enqueueJob(id, { priority });

  await trackServerEvent({
    userId,
    event: "screenshot_retried",
    properties: { source_screenshot_id: screenshotId, job_id: id, credits_charged: ensure.units },
  }).catch(() => {});

  return { jobId: id };
}
