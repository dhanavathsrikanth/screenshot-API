import { supabaseConfig } from "@/lib/env";

/** Supabase Storage bucket used as the fallback when R2 uploads fail. */
function bucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || "screenshots";
}

/**
 * Upload a file to a Supabase Storage bucket and return its public URL.
 * Used only as the R2 fallback path — the primary store is Cloudflare R2.
 *
 * Supabase Storage exposes a simple REST API that accepts the raw bytes with
 * the service-role key; x-upsert lets a retried key overwrite cleanly.
 */
export async function uploadToSupabaseStorage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const { url, serviceRoleKey } = supabaseConfig;
  const bucket = bucketName();

  const res = await fetch(`${url}/storage/v1/object/${bucket}/${key}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      "x-upsert": "true",
      "content-type": contentType,
    },
    body: new Uint8Array(buffer),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      // ignore body parse errors
    }
    throw new Error(`Supabase storage upload failed (${res.status}): ${detail}`);
  }

  return `${url}/storage/v1/object/public/${bucket}/${key}`;
}

/** Delete an object from a Supabase Storage bucket (best-effort cleanup). */
export async function deleteFromSupabaseStorage(key: string): Promise<void> {
  const { url, serviceRoleKey } = supabaseConfig;
  const bucket = bucketName();

  const res = await fetch(`${url}/storage/v1/object/${bucket}/${key}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${serviceRoleKey}` },
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Supabase storage delete failed (${res.status})`);
  }
}

/**
 * Extract the object key from a public Supabase Storage URL.
 * Returns null when the URL isn't one of ours.
 */
export function supabaseStorageKeyFromUrl(input: string): string | null {
  const { url } = supabaseConfig;
  const bucket = bucketName();
  const prefix = `${url}/storage/v1/object/public/${bucket}/`;
  if (input.startsWith(prefix)) {
    const key = input.slice(prefix.length);
    return key.length > 0 ? key : null;
  }
  return null;
}
