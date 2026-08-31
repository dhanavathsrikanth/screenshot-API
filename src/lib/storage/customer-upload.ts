import { PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { validateTargetUrl, SsrfError } from "@/lib/security/ssrf";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { logger } from "@/lib/logger";

export const UPLOAD_PROVIDERS = ["s3", "r2", "gcs"] as const;
export type UploadProvider = (typeof UPLOAD_PROVIDERS)[number];

export type CustomerDestinationInput = {
  provider: UploadProvider;
  bucket: string;
  region: string;
  endpoint?: string | null;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrlPrefix?: string | null;
  pathPrefix?: string;
  forcePathStyle?: boolean;
};

export type StoredDestination = {
  project_id: string;
  user_id: string;
  provider: UploadProvider;
  bucket: string;
  region: string;
  endpoint: string | null;
  access_key_id: string;
  secret_encrypted: string;
  public_url_prefix: string | null;
  path_prefix: string;
  force_path_style: boolean;
  enabled: boolean;
};

const BUCKET_RE = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const PATH_PREFIX_RE = /^[a-zA-Z0-9/_-]{0,200}$/;

export function destinationAad(projectId: string): string {
  return `upload:${projectId}`;
}

export function encryptUploadSecret(secret: string, projectId: string): string {
  return encryptSecret(secret, destinationAad(projectId));
}

export function decryptUploadSecret(encrypted: string, projectId: string): string {
  return decryptSecret(encrypted, destinationAad(projectId));
}

export async function validateDestinationInput(
  input: CustomerDestinationInput
): Promise<{ ok: true; normalized: CustomerDestinationInput } | { ok: false; message: string }> {
  if (!UPLOAD_PROVIDERS.includes(input.provider)) {
    return { ok: false, message: "Provider must be s3, r2, or gcs." };
  }
  const bucket = input.bucket.trim().toLowerCase();
  if (!BUCKET_RE.test(bucket)) {
    return { ok: false, message: "Bucket name is invalid." };
  }
  const accessKeyId = input.accessKeyId.trim();
  const secretAccessKey = input.secretAccessKey.trim();
  if (!accessKeyId || !secretAccessKey) {
    return { ok: false, message: "Access key ID and secret are required." };
  }
  if (accessKeyId.length > 256 || secretAccessKey.length > 512) {
    return { ok: false, message: "Credentials are too long." };
  }

  let region = (input.region || "auto").trim();
  let endpoint = input.endpoint?.trim() || null;
  let forcePathStyle = input.forcePathStyle ?? true;

  if (input.provider === "s3") {
    region = region === "auto" || !region ? "us-east-1" : region;
    forcePathStyle = input.forcePathStyle ?? false;
  } else if (input.provider === "r2") {
    region = "auto";
    forcePathStyle = true;
    if (!endpoint) {
      return { ok: false, message: "R2 requires the S3 API endpoint (https://<accountid>.r2.cloudflarestorage.com)." };
    }
  } else {
    region = "auto";
    forcePathStyle = true;
    endpoint = endpoint || "https://storage.googleapis.com";
  }

  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol !== "https:") {
        return { ok: false, message: "Bucket endpoint must use https." };
      }
      await validateTargetUrl(endpoint);
    } catch (e) {
      if (e instanceof SsrfError) return { ok: false, message: e.message };
      return { ok: false, message: "Bucket endpoint is not a valid URL." };
    }
  }

  let publicUrlPrefix = input.publicUrlPrefix?.trim() || null;
  if (publicUrlPrefix) {
    publicUrlPrefix = publicUrlPrefix.replace(/\/$/, "");
    try {
      const parsed = new URL(publicUrlPrefix);
      if (parsed.protocol !== "https:") {
        return { ok: false, message: "Public URL prefix must use https." };
      }
      await validateTargetUrl(publicUrlPrefix);
    } catch (e) {
      if (e instanceof SsrfError) return { ok: false, message: e.message };
      return { ok: false, message: "Public URL prefix is not a valid URL." };
    }
  } else if (input.provider === "r2") {
    return { ok: false, message: "R2 needs a public URL prefix (r2.dev or your custom domain)." };
  }

  const pathPrefix = (input.pathPrefix ?? "screenshots").replace(/^\/+|\/+$/g, "");
  if (!PATH_PREFIX_RE.test(pathPrefix) || pathPrefix.includes("..")) {
    return { ok: false, message: "Path prefix may only contain letters, numbers, /, _, and -." };
  }

  return {
    ok: true,
    normalized: {
      provider: input.provider,
      bucket,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      publicUrlPrefix,
      pathPrefix,
      forcePathStyle,
    },
  };
}

function clientFor(dest: {
  provider: UploadProvider;
  region: string;
  endpoint: string | null;
  access_key_id: string;
  secretAccessKey: string;
  force_path_style: boolean;
}): S3Client {
  return new S3Client({
    region: dest.region || "auto",
    credentials: {
      accessKeyId: dest.access_key_id,
      secretAccessKey: dest.secretAccessKey,
    },
    ...(dest.endpoint ? { endpoint: dest.endpoint } : {}),
    forcePathStyle: dest.force_path_style,
  });
}

export function objectPublicUrl(
  dest: Pick<StoredDestination, "provider" | "bucket" | "region" | "public_url_prefix">,
  key: string
): string {
  if (dest.public_url_prefix) {
    return `${dest.public_url_prefix.replace(/\/$/, "")}/${key}`;
  }
  if (dest.provider === "gcs") {
    return `https://storage.googleapis.com/${dest.bucket}/${key}`;
  }
  const region = dest.region || "us-east-1";
  if (region === "us-east-1") {
    return `https://${dest.bucket}.s3.amazonaws.com/${key}`;
  }
  return `https://${dest.bucket}.s3.${region}.amazonaws.com/${key}`;
}

export function customerObjectKey(pathPrefix: string, filename: string): string {
  const prefix = pathPrefix.replace(/^\/+|\/+$/g, "");
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return prefix ? `${prefix}/${safeName}` : safeName;
}

export async function uploadToCustomerBucket(
  dest: StoredDestination,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const secretAccessKey = decryptUploadSecret(dest.secret_encrypted, dest.project_id);
  const s3 = clientFor({ ...dest, secretAccessKey });
  const key = customerObjectKey(dest.path_prefix, filename);
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: dest.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return { url: objectPublicUrl(dest, key), key };
  } finally {
    s3.destroy();
  }
}

export async function testCustomerDestination(
  dest: Omit<StoredDestination, "secret_encrypted" | "enabled" | "user_id" | "project_id"> & {
    secretAccessKey: string;
    project_id: string;
  }
): Promise<void> {
  const s3 = clientFor({
    provider: dest.provider,
    region: dest.region,
    endpoint: dest.endpoint,
    access_key_id: dest.access_key_id,
    secretAccessKey: dest.secretAccessKey,
    force_path_style: dest.force_path_style,
  });
  const key = customerObjectKey(dest.path_prefix, `screenshotapi-connection-test-${Date.now()}.txt`);
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: dest.bucket,
        Key: key,
        Body: Buffer.from("screenshotapi connection test\n"),
        ContentType: "text/plain",
      })
    );
    await s3.send(new DeleteObjectCommand({ Bucket: dest.bucket, Key: key })).catch(() => {});
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.warn({ event: "customer_upload_test_failed", error: message });
    throw new Error(message);
  } finally {
    s3.destroy();
  }
}
