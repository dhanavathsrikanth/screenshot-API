import { createServiceClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { trackServerEvent } from "@/lib/posthog";

function normalizeApiKeyId(apiKeyId?: string | null): string | null {
  if (!apiKeyId || apiKeyId.trim() === "") return null;
  return apiKeyId;
}

/** Ensure a default project exists when the schema expects project_id. */
async function resolveProjectId(
  userId: string,
  explicit?: string | null
): Promise<string | null> {
  if (explicit) return explicit;
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name: "Default Project" })
    .select("id")
    .single();
  if (error) {
    console.warn("[saveScreenshot] could not create default project:", error.message);
    return null;
  }
  return created.id;
}

function isProjectColumnError(error: { message?: string; code?: string }) {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    msg.includes("project_id") ||
    msg.includes("projects")
  );
}

export async function saveScreenshot(params: {
  userId: string;
  projectId?: string | null;
  apiKeyId?: string;
  sourceUrl?: string;
  storageUrl: string | null;
  format: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  cached: boolean;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  const projectId = await resolveProjectId(params.userId, params.projectId);

  const baseRow = {
    user_id: params.userId,
    api_key_id: normalizeApiKeyId(params.apiKeyId),
    url: params.sourceUrl ?? null,
    storage_url: params.storageUrl,
    format: params.format,
    width: params.width,
    height: params.height,
    file_size_bytes: params.fileSizeBytes,
    cached: params.cached,
    metadata: params.metadata ?? {},
  };

  let payload: Record<string, unknown> =
    projectId != null ? { ...baseRow, project_id: projectId } : baseRow;

  let { data, error } = await supabase
    .from("screenshots")
    .insert(payload)
    .select("id")
    .single();

  if (error && isProjectColumnError(error)) {
    ({ data, error } = await supabase
      .from("screenshots")
      .insert(baseRow)
      .select("id")
      .single());
  }

  if (error && projectId != null && !isProjectColumnError(error)) {
    // FK or transient project issue — retry without project_id.
    ({ data, error } = await supabase
      .from("screenshots")
      .insert(baseRow)
      .select("id")
      .single());
  }

  if (error) {
    logger.error({
      event: "save_screenshot_failed",
      userId: params.userId,
      error: error.message,
      code: error.code,
      details: error.details,
    });
    trackServerEvent({
      userId: params.userId,
      event: "save_screenshot_failed",
      properties: { code: error.code, message: error.message },
    }).catch(() => {});
    throw error;
  }
  return data;
}
