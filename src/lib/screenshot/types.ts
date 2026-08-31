import type { ScreenshotOptions } from "@/lib/schema";

export interface RenderResult {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
}

/**
 * Business-logic-level render failure with a stable machine code
 * (e.g. SSRF_BLOCKED, NAVIGATION_FAILED, RENDER_TIMEOUT). The API layer
 * surfaces `code` to customers and the job layer stores it on the job row.
 */
export class RenderError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "RenderError";
  }
}

/** Operator-facing pipeline stage for render failures. */
export function renderPhase(code: string): "validate" | "geo" | "navigate" | "render" | "encode" | "upload" {
  const c = code.toUpperCase();
  if (c.includes("SSRF") || c === "INVALID_URL") return "validate";
  if (c.includes("GEO") || c.includes("COUNTRY")) return "geo";
  if (c.includes("NAVIGATION") || c.includes("REDIRECT") || c.includes("HTTP")) return "navigate";
  if (c.includes("VIDEO") || c.includes("FFMPEG") || c.includes("RECORD")) return "encode";
  if (c.includes("UPLOAD") || c.includes("STORAGE")) return "upload";
  return "render";
}

/**
 * Swappable rendering backend. The rest of the system (API routes, jobs,
 * storage) depends only on this interface, so the browser engine can later
 * move to a separate worker without touching business logic.
 */
export interface Renderer {
  render(options: ScreenshotOptions): Promise<RenderResult>;
}
