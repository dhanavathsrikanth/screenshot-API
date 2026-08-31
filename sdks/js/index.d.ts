export class ScreenshotAPIError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown);
}

export type TakeParams = Record<string, string | number | boolean | undefined>;

export function signTakeUrl(input: {
  baseUrl: string;
  accessKey: string;
  signingSecret: string;
  params?: TakeParams;
  expires?: number;
}): Promise<string>;

export class ScreenshotAPI {
  constructor(opts: { apiKey: string; baseUrl?: string; fetch?: typeof fetch });
  take(params: TakeParams): Promise<Uint8Array>;
  takeJson(body: TakeParams): Promise<Record<string, unknown>>;
  bulk(body: Record<string, unknown>): Promise<Record<string, unknown>>;
  createJob(body: TakeParams): Promise<Record<string, unknown>>;
  getJob(id: string): Promise<Record<string, unknown>>;
  waitForJob(id: string, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<Record<string, unknown>>;
}

export default ScreenshotAPI;
