import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ScreenshotOptionsSchema } from "@/lib/schema";
import { render } from "@/screenshot-engine/renderer";
import { uploadToStorage } from "@/screenshot-engine/uploader";
import { getCacheKey, getFromCache, setInCache } from "@/screenshot-engine/cache";
import { getFilename } from "@/lib/utils";
import { logScreenshotUsage } from "@/app/actions/usage";
import { saveScreenshot } from "@/app/actions/screenshots";

async function getAuthContext(request: NextRequest) {
  const headerUserId = request.headers.get("x-user-id");
  const headerApiKeyId = request.headers.get("x-api-key-id");

  if (headerUserId) {
    return { userId: headerUserId, apiKeyId: headerApiKeyId };
  }

  try {
    const { userId } = await auth();
    return { userId, apiKeyId: null };
  } catch {
    return { userId: null, apiKeyId: null };
  }
}

function uniqueKey(url: string, format: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const base = getFilename(url, format);
  return `${ts}_${rand}_${base}`;
}

function saveAndLog(
  userId: string | undefined,
  apiKeyId: string | undefined,
  buffer: Buffer,
  result: { format: string; width: number; height: number },
  options: { url?: string; method: string; cached: boolean },
  startTime: number
) {
  if (!userId) return;

  const key = uniqueKey(options.url ?? "screenshot", result.format);

  uploadToStorage(buffer, key, `image/${result.format}`)
    .then((publicUrl) => {
      saveScreenshot({
        userId,
        apiKeyId: apiKeyId ?? undefined,
        sourceUrl: options.url,
        storageUrl: publicUrl,
        format: result.format,
        width: result.width,
        height: result.height,
        fileSizeBytes: buffer.length,
        cached: options.cached,
      }).catch((e) => console.error("[saveScreenshot]", e.message));

      logScreenshotUsage({
        userId,
        apiKeyId: apiKeyId ?? undefined,
        endpoint: "/api/take",
        method: options.method,
        statusCode: 200,
        screenshotUrl: publicUrl,
        cached: options.cached,
        responseTimeMs: Date.now() - startTime,
      }).catch(() => {});
    })
    .catch(() => {});
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const rawParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawParams[key] = value;
    });

    const parsed = ScreenshotOptionsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const options = parsed.data;

    if (!options.url && !options.html && !options.markdown) {
      return NextResponse.json(
        { error: "Must provide url, html, or markdown parameter" },
        { status: 400 }
      );
    }

    const cacheKey = getCacheKey(rawParams);
    const cached = getFromCache(cacheKey);

    if (cached) {
      const { userId, apiKeyId } = await getAuthContext(request);
      saveAndLog(
        userId ?? undefined,
        apiKeyId ?? undefined,
        Buffer.from(cached.buffer),
        {
          format: cached.metadata.format as string,
          width: cached.metadata.width as number,
          height: cached.metadata.height as number,
        },
        { url: options.url, method: "GET", cached: true },
        startTime
      );
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          "Content-Type": `image/${options.format === "jpeg" ? "jpeg" : options.format}`,
          "Content-Length": cached.buffer.length.toString(),
          "X-Cache": "HIT",
        },
      });
    }

    const result = await render(options);

    setInCache(cacheKey, result.buffer, {
      width: result.width,
      height: result.height,
      format: result.format,
    });

    const ext = options.format === "jpeg" ? "jpg" : options.format;

    const { userId, apiKeyId } = await getAuthContext(request);
    saveAndLog(
      userId ?? undefined,
      apiKeyId ?? undefined,
      result.buffer,
      { format: result.format, width: result.width, height: result.height },
      { url: options.url, method: "GET", cached: false },
      startTime
    );

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type":
          options.format === "pdf"
            ? "application/pdf"
            : `image/${options.format === "jpeg" ? "jpeg" : options.format}`,
        "Content-Length": result.buffer.length.toString(),
        "Content-Disposition": `inline; filename="${getFilename(options.url ?? "screenshot", ext)}"`,
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const parsed = ScreenshotOptionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid parameters", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const options = parsed.data;

    if (!options.url && !options.html && !options.markdown) {
      return NextResponse.json(
        { error: "Must provide url, html, or markdown parameter" },
        { status: 400 }
      );
    }

    const result = await render(options);

    let publicUrl: string | null = null;
    try {
      const key = uniqueKey(options.url ?? "screenshot", result.format);
      publicUrl = await uploadToStorage(result.buffer, key, `image/${result.format}`);
    } catch {
      // Storage unavailable — still return the screenshot
    }

    const { userId, apiKeyId } = await getAuthContext(request);
    if (userId && publicUrl) {
      saveScreenshot({
        userId,
        apiKeyId: apiKeyId ?? undefined,
        sourceUrl: options.url,
        storageUrl: publicUrl,
        format: result.format,
        width: result.width,
        height: result.height,
        fileSizeBytes: result.buffer.length,
        cached: false,
      }).catch((e) => console.error("[saveScreenshot]", e.message));

      logScreenshotUsage({
        userId,
        apiKeyId: apiKeyId ?? undefined,
        endpoint: "/api/take",
        method: "POST",
        statusCode: 200,
        screenshotUrl: publicUrl,
        cached: false,
        responseTimeMs: Date.now() - startTime,
      }).catch((e) => console.error("[logScreenshotUsage]", e.message));
    }

    return NextResponse.json({
      url: publicUrl,
      format: result.format,
      width: result.width,
      height: result.height,
      size: result.buffer.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
