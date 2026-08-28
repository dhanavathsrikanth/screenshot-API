import { NextRequest } from "next/server";
import { z } from "zod";
import { resolveAuth } from "@/lib/api-auth";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { getJob } from "@/lib/jobs";
import { createServiceClient } from "@/lib/supabase/server";
import { createScreenshotShare, shareUrlFor, MAX_SHARE_EXPIRY_DAYS } from "@/lib/shares";

export const maxDuration = 60;

const ShareCreateSchema = z.object({
  /** Link lifetime in days (1–30). Defaults to 7. */
  expires_in_days: z.coerce.number().int().min(1).max(MAX_SHARE_EXPIRY_DAYS).default(7),
});

/**
 * Create an expiring share link for a capture. Accepts either a job id
 * (GET /api/v1/screenshots/{id}) or a screenshot id.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

    const body = await request.json().catch(() => ({}));
    const parsed = ShareCreateSchema.safeParse(body);
    if (!parsed.success) {
      return v1Err(400, "invalid_parameters", "Invalid parameters.", requestId, parsed.error.flatten());
    }

    // Resolve the capture's screenshot row: direct screenshot id first,
    // then job id → its saved screenshot.
    const supabase = createServiceClient();
    let screenshotId: string | null = null;

    const direct = await supabase
      .from("screenshots")
      .select("id")
      .eq("id", id)
      .eq("user_id", authCtx.userId)
      .maybeSingle();
    if (direct.data) {
      screenshotId = direct.data.id;
    } else {
      const job = await getJob(id);
      if (job && job.user_id === authCtx.userId && job.screenshot_id) {
        const owned = await supabase
          .from("screenshots")
          .select("id")
          .eq("id", job.screenshot_id)
          .eq("user_id", authCtx.userId)
          .maybeSingle();
        screenshotId = owned.data?.id ?? null;
      }
    }

    if (!screenshotId) {
      return v1Err(404, "not_found", "Screenshot not found.", requestId);
    }

    const share = await createScreenshotShare({
      userId: authCtx.userId,
      screenshotId,
      expiresInDays: parsed.data.expires_in_days,
    });

    return v1Ok(
      {
        id: share.id,
        url: shareUrlFor(share.token),
        expires_at: share.expires_at,
      },
      { status: 201, requestId }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
