/**
 * Official ScreenshotAPI JavaScript/TypeScript client.
 * Canonical HMAC for signed GET URLs must match src/lib/signed-url.ts
 */

function rfc3986Encode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function canonicalQuery(params) {
  return Object.keys(params)
    .filter((key) => key !== "signature" && params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${rfc3986Encode(key)}=${rfc3986Encode(String(params[key]))}`)
    .join("&");
}

async function hmacSha256Hex(secret, message) {
  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(message).digest("hex");
}

export function signTakeQuery(params, signingSecret) {
  const query = { ...params };
  delete query.signature;
  const canonical = canonicalQuery(query);
  return hmacSha256Hex(signingSecret, canonical).then((signature) => ({ canonical, signature }));
}

export async function signTakeUrl({
  baseUrl,
  accessKey,
  signingSecret,
  params = {},
  expires,
}) {
  const query = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || key === "signature" || key === "access_key") continue;
    query[key] = String(value);
  }
  query.access_key = accessKey;
  if (expires !== undefined) query.expires = String(expires);
  const { canonical, signature } = await signTakeQuery(query, signingSecret);
  const base = String(baseUrl).replace(/\/$/, "");
  const path = base.endsWith("/api/take") ? base : `${base}/api/take`;
  return `${path}?${canonical}&signature=${signature}`;
}

function joinUrl(base, path) {
  return `${String(base).replace(/\/$/, "")}${path}`;
}

export class ScreenshotAPIError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "ScreenshotAPIError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ScreenshotAPI {
  constructor({ apiKey, baseUrl = "https://api.screenshotapi.tech", fetch: fetchFn } = {}) {
    if (!apiKey) throw new Error("ScreenshotAPI requires apiKey");
    this.apiKey = apiKey;
    this.baseUrl = String(baseUrl).replace(/\/$/, "");
    this.fetch = fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  async request(path, { method = "GET", query, body, raw } = {}) {
    const url = new URL(joinUrl(this.baseUrl, path));
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === "") continue;
        url.searchParams.set(k, String(v));
      }
    }
    const headers = { Authorization: `Bearer ${this.apiKey}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await this.fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (raw) {
      if (!res.ok) {
        let code = "http_error";
        let message = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          code = errBody.error?.code ?? code;
          message = errBody.error?.message ?? message;
        } catch {
          /* ignore */
        }
        throw new ScreenshotAPIError(res.status, code, message);
      }
      return res;
    }
    const json = await res.json();
    if (!res.ok) {
      throw new ScreenshotAPIError(
        res.status,
        json.error?.code ?? "http_error",
        json.error?.message ?? `HTTP ${res.status}`,
        json.error?.details
      );
    }
    return json.data ?? json;
  }

  /** GET /api/take — image bytes */
  async take(params) {
    const res = await this.request("/api/take", { query: params, raw: true });
    return new Uint8Array(await res.arrayBuffer());
  }

  /** POST /api/take — JSON with storage_url */
  takeJson(body) {
    return this.request("/api/take", { method: "POST", body });
  }

  bulk(body) {
    return this.request("/api/take/bulk", { method: "POST", body });
  }

  createJob(body) {
    return this.request("/api/v1/screenshots", { method: "POST", body });
  }

  getJob(id) {
    return this.request(`/api/v1/screenshots/${id}`);
  }

  async waitForJob(id, { intervalMs = 2000, timeoutMs = 90000 } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const job = await this.getJob(id);
      const status = job.status ?? job.data?.status;
      if (status === "completed" || status === "failed") return job;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new ScreenshotAPIError(408, "timeout", "Timed out waiting for screenshot job.");
  }
}

export default ScreenshotAPI;
