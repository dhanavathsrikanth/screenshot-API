import type { ScreenshotOptions } from "@/lib/schema";
import { render } from "./renderer";
import { sleep } from "@/lib/utils";

export interface BulkConfig {
  concurrency: number;
  maxRetries: number;
}

export interface BulkItemResult {
  url: string;
  success: boolean;
  error?: string;
  attempts: number;
  renderResult?: { buffer: Buffer; format: string; width: number; height: number };
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const retryable = [
    "net::ERR_CONNECTION",
    "net::ERR_TIMED_OUT",
    "Navigation timeout",
    "Protocol error",
  ];
  return retryable.some((msg) => error.message.includes(msg));
}

async function renderWithRetry(
  options: ScreenshotOptions & { url: string },
  maxRetries: number
): Promise<BulkItemResult> {
  let lastError: unknown;
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts = attempt + 1;
    try {
      const rr = await render(options);
      return { url: options.url, success: true, attempts, renderResult: rr };
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxRetries) break;
      await sleep(1000 * (attempt + 1));
    }
  }

  return {
    url: options.url,
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    attempts,
  };
}

export async function bulkRender(
  urls: string[],
  baseOptions: ScreenshotOptions,
  config: BulkConfig
): Promise<BulkItemResult[]> {
  const queue = [...urls];
  const results: BulkItemResult[] = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) return;
      const result = await renderWithRetry(
        { ...baseOptions, url },
        config.maxRetries
      );
      results.push(result);
    }
  }

  const workers = Array(config.concurrency).fill(null).map(() => worker());
  await Promise.all(workers);

  return results;
}
