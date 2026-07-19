import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { BulkScreenshotSchema } from "@/lib/schema";
import { bulkRender } from "@/screenshot-engine/bulk";
import { uploadToStorage } from "@/screenshot-engine/uploader";
import { saveScreenshot } from "@/app/actions/screenshots";
import { logScreenshotUsage } from "@/app/actions/usage";
import { getFilename } from "@/lib/utils";

function uniqueKey(url: string, format: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const base = getFilename(url, format);
  return `${ts}_${rand}_${base}`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const parsed = BulkScreenshotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { urls, concurrency, max_retries, ...renderOptions } = parsed.data;

    const results = await bulkRender(urls, renderOptions, {
      concurrency,
      maxRetries: max_retries,
    });

    const headerUserId = request.headers.get("x-user-id");
    const headerApiKeyId = request.headers.get("x-api-key-id");
    let userId = headerUserId;
    let apiKeyId = headerApiKeyId;
    if (!userId) {
      try {
        const authResult = await auth();
        userId = authResult.userId;
      } catch {
        // unauthenticated
      }
    }

    if (userId) {
      for (const r of results) {
        if (r.success && r.renderResult) {
          const key = uniqueKey(r.url, r.renderResult.format);
          uploadToStorage(
            r.renderResult.buffer,
            key,
            `image/${r.renderResult.format}`
          )
            .then((publicUrl) => {
              saveScreenshot({
                userId,
                apiKeyId: apiKeyId ?? undefined,
                storageUrl: publicUrl,
                format: r.renderResult!.format,
                width: r.renderResult!.width,
                height: r.renderResult!.height,
                fileSizeBytes: r.renderResult!.buffer.length,
                cached: false,
              }).catch(() => {});

              logScreenshotUsage({
                userId,
                apiKeyId: apiKeyId ?? undefined,
                endpoint: "/api/take/bulk",
                method: "POST",
                statusCode: 200,
                screenshotUrl: publicUrl,
                cached: false,
                responseTimeMs: Math.round((Date.now() - startTime) / results.length),
              }).catch(() => {});
            })
            .catch(() => {});
        }
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      total: results.length,
      successful,
      failed,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      results: results.map(({ renderResult, ...rest }) => rest),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
