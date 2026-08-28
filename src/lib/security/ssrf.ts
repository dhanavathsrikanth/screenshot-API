import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { cacheGet, cacheSet } from "@/lib/redis";

const DNS_CACHE_TTL_SECONDS = 60;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export class SsrfError extends Error {
  constructor(
    public code: "INVALID_URL" | "SSRF_BLOCKED",
    message: string
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a === 169 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** IPv4-mapped IPv6 (::ffff:0:0/96): the low 32 bits are an IPv4 address. */
function ipv4FromMappedIpv6(lower: string): string | null {
  if (!lower.startsWith("::ffff:")) return null;
  const tail = lower.slice("::ffff:".length);

  const dotted = tail.match(/^(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return dotted[1];

  const hex = tail.match(/^[0-9a-f]{1,4}:[0-9a-f]{1,4}$/);
  if (hex) {
    const [hi, lo] = tail.split(":");
    const n = parseInt(hi, 16) * 65536 + parseInt(lo, 16);
    return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
  }

  return null;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;

  const mapped = ipv4FromMappedIpv6(lower);
  if (mapped !== null) return isPrivateIpv4(mapped);

  return (
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    (lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb"))
  );
}

export function isPrivateIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateIpv4(ip);
  if (kind === 6) return isPrivateIpv6(ip);
  return true;
}

async function resolveHostname(hostname: string): Promise<string[]> {
  const cacheKey = `cache:ssrf:dns:${hostname}`;
  const cached = await cacheGet<string[]>(cacheKey);
  if (cached && cached.length > 0) return cached;

  try {
    const addresses = await lookup(hostname, { all: true });
    const ips = addresses.map((a) => a.address);
    await cacheSet(cacheKey, ips, DNS_CACHE_TTL_SECONDS);
    return ips;
  } catch {
    throw new SsrfError("SSRF_BLOCKED", `Could not resolve hostname "${hostname}".`);
  }
}

/**
 * Reject URL targets that a headless browser should never visit:
 * non-http(s) schemes, loopback/link-local/private literals, and public
 * hostnames that resolve to private/reserved addresses.
 */
export async function validateTargetUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfError("INVALID_URL", "The supplied URL is invalid.");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new SsrfError(
      "SSRF_BLOCKED",
      `Protocol "${parsed.protocol.replace(":", "")}://" is not allowed. Only http:// and https:// are supported.`
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const cleanHost = hostname.replace(/^\[|\]$/g, "");

  const literalKind = isIP(cleanHost);
  if (literalKind !== 0) {
    if (isPrivateIp(cleanHost)) {
      throw new SsrfError("SSRF_BLOCKED", "Private or reserved IP addresses are not allowed.");
    }
    return;
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  ) {
    throw new SsrfError("SSRF_BLOCKED", "Local hostnames are not allowed.");
  }

  const ips = await resolveHostname(hostname);
  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      throw new SsrfError(
        "SSRF_BLOCKED",
        `Hostname "${hostname}" resolves to a private or reserved IP address.`
      );
    }
  }
}

/** Redirect destinations must pass the same checks as the original target. */
export function validateRedirectUrl(rawUrl: string): Promise<void> {
  return validateTargetUrl(rawUrl);
}
