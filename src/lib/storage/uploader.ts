import { S3Client, S3ClientConfig, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

let client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!client) {
    const endpoint = env("R2_ENDPOINT");
    const accessKeyId = env("R2_ACCESS_KEY_ID");
    const secretAccessKey = env("R2_SECRET_ACCESS_KEY");

    const cfg: S3ClientConfig = {
      region: "auto",
      credentials: { accessKeyId, secretAccessKey },
      endpoint,
      forcePathStyle: true,
    };

    client = new S3Client(cfg);
  }
  return client;
}

export async function uploadToStorage(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const bucket = env("R2_BUCKET_NAME");
  const publicUrl = env("R2_PUBLIC_URL");

  const s3 = getS3Client();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${publicUrl}/${key}`;
}

export async function deleteFromStorage(key: string): Promise<void> {
  const bucket = env("R2_BUCKET_NAME");
  const s3 = getS3Client();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/** Extract the object key from a public R2 URL (returns null when not ours). */
export function storageKeyFromUrl(url: string): string | null {
  const prefix = env("R2_PUBLIC_URL");
  if (url.startsWith(`${prefix}/`)) {
    const key = url.slice(prefix.length + 1);
    return key.length > 0 ? key : null;
  }
  return null;
}
