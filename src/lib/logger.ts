type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  event: string;
  requestId?: string;
  userId?: string;
  projectId?: string;
  jobId?: string;
  [k: string]: unknown;
}

function write(level: LogLevel, fields: LogFields): void {
  const entry = { level, ts: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  if (level === "error") void forwardToSentry(fields);
}

async function forwardToSentry(fields: LogFields): Promise<void> {
  if (typeof process === "undefined") return;
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    const { event, ...extra } = fields;
    Sentry.captureException(new Error(event), { extra });
  } catch {
    // Observability must never break the request path.
  }
}

export const logger = {
  info: (fields: LogFields) => write("info", fields),
  warn: (fields: LogFields) => write("warn", fields),
  error: (fields: LogFields) => write("error", fields),
};
