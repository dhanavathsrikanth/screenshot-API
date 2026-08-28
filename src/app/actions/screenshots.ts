import { createServiceClient } from "@/lib/supabase/server";

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
  const { data, error } = await supabase
    .from("screenshots")
    .insert({
      user_id: params.userId,
      project_id: params.projectId ?? null,
      api_key_id: params.apiKeyId ?? null,
      url: params.sourceUrl ?? null,
      storage_url: params.storageUrl,
      format: params.format,
      width: params.width,
      height: params.height,
      file_size_bytes: params.fileSizeBytes,
      cached: params.cached,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("[saveScreenshot]", error.message, error.details);
    throw error;
  }
  return data;
}
