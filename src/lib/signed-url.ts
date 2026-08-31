import { createHmac, timingSafeEqual } from "node:crypto";

/** Query keys that authenticate a GET /api/take call and must not affect the render cache. */
export const SIGNED_URL_AUTH_PARAMS = ["access_key", "signature", "expires"] as const;

const AUTH_PARAM_SET = new Set<string>(SIGNED_URL_AUTH_PARAMS);

/** RFC 3986 percent-encoding (unreserved: A-Z a-z 0-9 - . _ ~). */
export function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * Canonical query used as the HMAC message. Keys are sorted; `signature` is
 * omitted. Values are the decoded strings the client intended (same as
 * URLSearchParams.get).
 */
export function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== "signature" && params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${rfc3986Encode(key)}=${rfc3986Encode(params[key])}`)
    .join("&");
}

export function signCanonicalQuery(canonical: string, signingSecret: string): string {
  return createHmac("sha256", signingSecret).update(canonical).digest("hex");
}

export function signaturesMatch(expectedHex: string, provided: string): boolean {
  const a = Buffer.from(expectedHex, "utf8");
  const b = Buffer.from(provided.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isSignedUrlAuthParam(key: string): boolean {
  return AUTH_PARAM_SET.has(key);
}

export function stripSignedUrlAuthParams(
  params: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!isSignedUrlAuthParam(key)) out[key] = value;
  }
  return out;
}

export type SignTakeUrlInput = {
  baseUrl: string;
  accessKey: string;
  signingSecret: string;
  params: Record<string, string | number | boolean | undefined>;
  /** Unix timestamp in seconds. Omit for a non-expiring URL (not recommended). */
  expires?: number;
};

/**
 * Build a GET /api/take URL that browsers can load without an Authorization
 * header. `access_key` is public; `signingSecret` must stay on the server.
 */
export function signTakeUrl(input: SignTakeUrlInput): string {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.params)) {
    if (value === undefined || value === "") continue;
    if (isSignedUrlAuthParam(key)) continue;
    query[key] = String(value);
  }
  query.access_key = input.accessKey;
  if (input.expires !== undefined) {
    query.expires = String(input.expires);
  }
  const canonical = canonicalQuery(query);
  const signature = signCanonicalQuery(canonical, input.signingSecret);
  const qs = `${canonical}&signature=${signature}`;
  const base = input.baseUrl.replace(/\/$/, "");
  const path = base.endsWith("/api/take") ? base : `${base}/api/take`;
  return `${path}?${qs}`;
}

export type SignedUrlVerifyFailure =
  | "missing"
  | "expired"
  | "invalid_expires"
  | "bad_signature";

export function verifySignedQuery(
  params: Record<string, string>,
  signingSecret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): { ok: true } | { ok: false; reason: SignedUrlVerifyFailure } {
  const accessKey = params.access_key?.trim();
  const signature = params.signature?.trim();
  if (!accessKey || !signature) return { ok: false, reason: "missing" };

  if (params.expires) {
    const expires = Number.parseInt(params.expires, 10);
    if (!Number.isFinite(expires) || expires <= 0) {
      return { ok: false, reason: "invalid_expires" };
    }
    if (nowSeconds > expires) return { ok: false, reason: "expired" };
  }

  const expected = signCanonicalQuery(canonicalQuery(params), signingSecret);
  if (!signaturesMatch(expected, signature)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true };
}
