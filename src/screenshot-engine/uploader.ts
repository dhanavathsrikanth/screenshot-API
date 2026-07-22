import { S3Client, S3ClientConfig, PutObjectCommand } from "@aws-sdk/client-s3";
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
