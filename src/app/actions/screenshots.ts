import { createClient } from "@/lib/supabase/server";

export async function saveScreenshot(params: {
  userId: string;
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screenshots")
    .insert({
      user_id: params.userId,
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
