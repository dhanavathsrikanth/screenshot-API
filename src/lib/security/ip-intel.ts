import { logger } from "@/lib/logger";

/**
 * IP intelligence for guest gating, backed by IPLocate
 * (https://iplocate.io/docs/ip-intelligence-api, GET /api/lookup/:ip).
 *
 * Enabled by default — IPLocate's free endpoint answers without a key, so the
 * blocklist is active out of the box. Set IPLOCATE_API_KEY to raise the
 * lookup quota, or set IPINTEL_DISABLED=1 to turn the whole feature off.
 *
 * Lookups are billed per request, so results are cached in-process for
 * IPINTEL_CACHE_TTL_SECONDS and failures fail open (a slow/down provider never
 * breaks the public demo).
 */

export interface IpIntelPrivacy {
  is_abuser?: boolean;
  is_anonymous?: boolean;
  is_bogon?: boolean;
  is_hosting?: boolean;
  is_icloud_relay?: boolean;
  is_proxy?: boolean;
  is_tor?: boolean;
  is_vpn?: boolean;
}

export interface IpIntel {
  ip?: string | null;
  country_code?: string | null;
  privacy?: IpIntelPrivacy;
  hosting?: { provider?: string } | null;
  company?: { type?: string } | null;
}

export type GuestIpVerdict =
  | { allowed: true }
  | { allowed: false; code: string; message: string; detail: string };

const API_BASE = process.env.IPLOCATE_API_BASE ?? "https://iplocate.io/api/lookup";
const LOOKUP_TIMEOUT_MS = 2500;
const NEGATIVE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 2000;

const lookupCache = new Map<string, { expiresAt: number; intel: IpIntel }>();
const negativeCache = new Map<string, { expiresAt: number }>();

const MODE_LABELS: Record<string, string> = {
  abuser: "currently on an abuse blocklist",
  tor: "a Tor exit node",
  proxy: "a known proxy",
  vpn: "a VPN provider",
  relay: "an anonymous relay (e.g. iCloud Private Relay)",
  hosting: "a datacenter or cloud hosting network",
  bogon: "an invalid (bogon) address",
};

function cacheTtlMs(): number {
  const raw = process.env.IPINTEL_CACHE_TTL_SECONDS;
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n * 1000 : 30 * 60 * 1000;
}

function blockedModes(): Set<string> {
  const raw = process.env.IPINTEL_BLOCK_MODES;
  const modes = (raw ?? "abuser,tor,proxy,vpn,hosting")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(modes);
}

function blockedCountries(): Set<string> {
  const raw = process.env.IPINTEL_BLOCK_COUNTRIES ?? "";
  return new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean));
}

function isPrivateOrLoopback(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (!v || v === "unknown") return true;
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const addr = mapped ? mapped[1] : v;
  const parts = addr.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  return false;
}

async function requestIntel(ip: string): Promise<IpIntel | null> {
  const params = new URLSearchParams({ include: "country_code,privacy,hosting,company" });
  const apikey = process.env.IPLOCATE_API_KEY;
  if (apikey) params.set("apikey", apikey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(ip)}?${params.toString()}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      logger.warn({
        event: "ipintel_lookup_rejected",
        ip,
        status: res.status,
      });
      return null;
    }
    const intel = (await res.json().catch(async () => null)) as IpIntel | null;
    if (intel === null || typeof intel !== "object") {
      const raw = await res.text().catch(() => "");
      logger.warn({ event: "ipintel_parse_failed", ip, status: res.status, body: raw.slice(0, 200) });
      return null;
    }
    return intel;
  } catch (error) {
    logger.warn({
      event: "ipintel_lookup_failed",
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function trimCache(): void {
  if (lookupCache.size <= MAX_CACHE_ENTRIES) return;
  const entries = [...lookupCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  for (let i = 0; i < Math.ceil(entries.length / 2); i++) lookupCache.delete(entries[i][0]);
  if (negativeCache.size > 1000) negativeCache.clear();
}

function blockedVerdict(mode: string, intel: IpIntel): GuestIpVerdict {
  const provider = intel.hosting?.provider ?? intel.company?.type ?? undefined;
  return {
    allowed: false,
    code: "guest_ip_restricted",
    message: `Free tools aren't available from ${MODE_LABELS[mode] ?? `a restricted network (${mode})`}. Sign in to get credits for access.`,
    detail: JSON.stringify({
      mode,
      country_code: intel.country_code ?? null,
      provider: provider ?? null,
    }),
  };
}

function applyRules(intel: IpIntel): GuestIpVerdict {
  const privacy = intel.privacy ?? {};
  const modes = blockedModes();
  const priority: Array<{ mode: string; hit: boolean | undefined }> = [
    { mode: "abuser", hit: privacy.is_abuser },
    { mode: "tor", hit: privacy.is_tor },
    { mode: "proxy", hit: privacy.is_proxy },
    { mode: "vpn", hit: privacy.is_vpn },
    { mode: "relay", hit: privacy.is_icloud_relay },
    { mode: "hosting", hit: privacy.is_hosting },
    { mode: "bogon", hit: privacy.is_bogon },
  ];
  for (const { mode, hit } of priority) {
    if (modes.has(mode) && hit === true) return blockedVerdict(mode, intel);
  }
  const countries = blockedCountries();
  if (countries.size > 0 && intel.country_code && countries.has(intel.country_code.toUpperCase())) {
    return {
      allowed: false,
      code: "guest_ip_restricted",
      message: "Free tools aren't available in your region. Sign in to get credits for access.",
      detail: JSON.stringify({ mode: "country", country_code: intel.country_code }),
    };
  }
  return { allowed: true };
}

/**
 * Gate a guest request by source IP. Returns `{ allowed: true }` whenever the
 * feature is disabled via IPINTEL_DISABLED, the source is local/private, or
 * the provider is unreachable (fail-open) so the demo never depends on a
 * third-party lookup.
 */
export async function evaluateGuestIp(ip: string): Promise<GuestIpVerdict> {
  if (process.env.IPINTEL_DISABLED === "1" || process.env.IPINTEL_DISABLED === "true") {
    return { allowed: true };
  }
  const trimmed = ip.trim();
  if (isPrivateOrLoopback(trimmed)) return { allowed: true };
  const now = Date.now();

  const cached = lookupCache.get(trimmed);
  if (cached && cached.expiresAt > now) return applyRules(cached.intel);
  const negated = negativeCache.get(trimmed);
  if (negated !== undefined && negated.expiresAt > now) return { allowed: true };

  const intel = await requestIntel(trimmed);
  if (!intel) {
    negativeCache.set(trimmed, { expiresAt: now + NEGATIVE_TTL_MS });
    return { allowed: true };
  }
  lookupCache.set(trimmed, { expiresAt: now + cacheTtlMs(), intel });
  trimCache();
  return applyRules(intel);
}