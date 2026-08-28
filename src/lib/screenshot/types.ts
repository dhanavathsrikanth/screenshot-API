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

/**
 * Swappable rendering backend. The rest of the system (API routes, jobs,
 * storage) depends only on this interface, so the browser engine can later
 * move to a separate worker without touching business logic.
 */
export interface Renderer {
  render(options: ScreenshotOptions): Promise<RenderResult>;
}
