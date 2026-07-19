export function getFilename(url: string, format: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/\./g, "_");
    return `${hostname}.${format}`;
  } catch {
    return `screenshot.${format}`;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const retryable = [
    "net::ERR_CONNECTION",
    "net::ERR_TIMED_OUT",
    "Navigation timeout",
    "Protocol error",
  ];
  return retryable.some((msg) => error.message.includes(msg));
}
