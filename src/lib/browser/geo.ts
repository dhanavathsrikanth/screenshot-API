import { randomBytes } from "node:crypto";

/**
 * Geo-targeted rendering: resolve an ISO 3166-1 alpha-2 country code to a
 * working proxy URL. Two provider modes are supported, checked in order:
 *
 * 1. GATEWAY MODE — GEO_PROXY_URL_TEMPLATE. One residential-proxy gateway
 *    endpoint where country targeting is encoded in the URL via placeholders,
 *    so switching providers is purely an environment change:
 *
 *      {country}       -> lowercased country code (us, de, jp)
 *      {country_upper} -> uppercased country code (US, DE, JP)
 *      {session}       -> numeric sticky-session id, unique per render attempt
 *      {random}        -> random hex per call (rotating exits)
 *
 *    Examples:
 *      Webshare:   http://{user}-{country}-{session}:pass@p.webshare.io:80
 *      IPRoyal:    http://{user}-cc-{country}-sessid-{session}:pass@geo.iproyal.com:12321
 *      Oxylabs:    http://customer-{user}-cc-{country}-sessid-{session}:pass@pr.oxylabs.io:7777
 *      BrightData: http://brd-customer-{user}-zone-{zone}-country-{country}:pass@brd.superproxy.io:22225
 *
 * 2. WEBSHARE DIRECT MODE — WEBSHARE_API_TOKEN. Resolves a concrete
 *    ip:port exit from the account's Proxy List REST API filtered by country
 *    (https://apidocs.webshare.io/proxy-list). Self-healing: when Webshare
 *    auto-replaces an invalid proxy, the next list fetch picks up the new
 *    address. The list is cached in-process for 5 minutes; the last known
 *    good list keeps serving if Webshare is briefly unreachable.
 */

/** Machine-readable failure reasons surfaced to API callers. */
export type GeoErrorCode =
  | "GEO_NOT_CONFIGURED"
  | "INVALID_COUNTRY"
  | "UNSUPPORTED_COUNTRY";

export class GeoTargetingError extends Error {
  constructor(
    public code: GeoErrorCode,
    message: string
  ) {
    super(message);
    this.name = "GeoTargetingError";
  }
}

/**
 * All officially assigned ISO 3166-1 alpha-2 codes (249). Requests for a
 * code outside this set fail fast with INVALID_COUNTRY before any
 * infrastructure is touched.
 */
const ISO_ALPHA2_CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ " +
  "BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
  "DE DJ DK DM DO DZ " +
  "EC EE EG EH ER ES ET " +
  "FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY " +
  "HK HM HN HR HT HU " +
  "ID IE IL IM IN IO IQ IR IS IT " +
  "JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ " +
  "LA LB LC LI LK LR LS LT LU LV LY " +
  "MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
  "NA NC NE NF NG NI NL NO NP NR NU NZ " +
  "OM " +
  "PA PE PF PG PH PK PL PM PN PR PS PT PW PY " +
  "QA " +
  "RE RO RS RU RW " +
  "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ " +
  "TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ " +
  "VA VC VE VG VI VN VU " +
  "WF WS " +
  "YE YT " +
  "ZA ZM ZW";

const ISO_ALPHA2 = new Set(ISO_ALPHA2_CODES.trim().split(/\s+/));

export function isIsoAlpha2(code: string): boolean {
  return ISO_ALPHA2.has(code.toUpperCase());
}

/** Trim + uppercase a user-supplied country code, or null when malformed. */
export function normalizeCountry(input: string): string | null {
  const cc = input.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cc) ? cc : null;
}

function geoTemplate(): string | null {
  const tpl = process.env.GEO_PROXY_URL_TEMPLATE;
  return tpl && tpl.trim().length > 0 ? tpl.trim() : null;
}

function webshareToken(): string | null {
  const t = process.env.WEBSHARE_API_TOKEN;
  return t && t.trim().length > 0 ? t.trim() : null;
}

/**
 * Optional allow-list restricting which countries the deployment serves
 * (e.g. only countries the proxy plan covers). Comma-separated ISO codes;
 * unset/empty means every country that the active provider can serve.
 */
export function getAllowedCountries(): string[] | null {
  const raw = process.env.GEO_PROXY_ALLOWED_COUNTRIES;
  if (!raw || raw.trim().length === 0) return null;
  const list = raw
    .split(",")
    .map((c) => normalizeCountry(c))
    .filter((c): c is string => c !== null);
  return list.length > 0 ? list : null;
}

/** True when any geo provider is configured. */
export function isGeoConfigured(): boolean {
  return geoTemplate() !== null || webshareToken() !== null;
}

// ─── Webshare Direct Mode (Proxy List REST API) ─────────────────────────

const WEBSHARE_LIST_TTL_MS = 5 * 60_000;

function webshareListUrl(): string {
  // Read per call so deployments/tests can point at an alternate base.
  const base = process.env.WEBSHARE_API_BASE ?? "https://proxy.webshare.io/api/v2";
  return `${base.replace(/\/$/, "")}/proxy/list/?mode=direct&page_size=100`;
}

interface WebshareProxy {
  proxy_address: string;
  port: number;
  username?: string | null;
  password?: string | null;
  valid: boolean;
  country_code: string;
}

interface CachedList {
  at: number;
  proxies: WebshareProxy[];
}

const webshareListCache = new Map<string, CachedList>();
let webshareListInflight: Promise<WebshareProxy[]> | null = null;

async function fetchWebshareList(token: string): Promise<WebshareProxy[]> {
  const res = await fetch(webshareListUrl(), {
    headers: { Authorization: `Token ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`webshare proxy list returned HTTP ${res.status}`);
  }
  const data = (await res.json()) as { results?: WebshareProxy[] };
  return Array.isArray(data.results) ? data.results : [];
}

async function getWebshareList(token: string): Promise<WebshareProxy[]> {
  const cached = webshareListCache.get(token);
  if (cached && Date.now() - cached.at < WEBSHARE_LIST_TTL_MS) {
    return cached.proxies;
  }
  if (!webshareListInflight) {
    webshareListInflight = fetchWebshareList(token)
      .then((proxies) => {
        webshareListCache.set(token, { at: Date.now(), proxies });
        return proxies;
      })
      .finally(() => {
        webshareListInflight = null;
      });
  }
  try {
    return await webshareListInflight;
  } catch {
    // Serve the last known good list rather than failing renders while
    // Webshare has a brief API hiccup.
    if (cached) return cached.proxies;
    throw new GeoTargetingError(
      "GEO_NOT_CONFIGURED",
      "Could not reach the Webshare API to resolve geo proxies."
    );
  }
}

function pickWebshareProxy(proxies: WebshareProxy[], cc: string): WebshareProxy {
  const matches = proxies.filter(
    (p) => p.valid && p.proxy_address && p.port && p.country_code?.toUpperCase() === cc
  );
  if (matches.length === 0) {
    throw new GeoTargetingError(
      "UNSUPPORTED_COUNTRY",
      `No proxy exit is currently available in "${cc}" on the configured provider.`
    );
  }
  return matches[Math.floor(Math.random() * matches.length)];
}

/** Test hook: age every cached list past its TTL so the next read refetches. */
export function __expireWebshareListCacheForTests(): void {
  for (const v of webshareListCache.values()) {
    v.at -= WEBSHARE_LIST_TTL_MS + 1;
  }
}

async function buildWebshareProxyUrl(token: string, cc: string): Promise<string> {
  const proxies = await getWebshareList(token);
  const pick = pickWebshareProxy(proxies, cc);
  const user = encodeURIComponent(pick.username ?? "");
  const pass = encodeURIComponent(pick.password ?? "");
  return `http://${user}:${pass}@${pick.proxy_address}:${pick.port}`;
}

// ─── Request validation + URL building ──────────────────────────────────

/**
 * Validate a country against the active geo provider WITHOUT building the
 * final proxy URL. Async so the Webshare mode can confirm an exit exists
 * (from the cached list) and requests fail fast before credits are charged.
 * Throws GeoTargetingError with a precise reason.
 */
export async function assertGeoRequestAllowed(rawCountry: string): Promise<string> {
  const cc = normalizeCountry(rawCountry);
  if (!cc || !isIsoAlpha2(cc)) {
    throw new GeoTargetingError(
      "INVALID_COUNTRY",
      `"${rawCountry}" is not a valid ISO 3166-1 alpha-2 country code.`
    );
  }

  const allowed = getAllowedCountries();
  if (allowed && !allowed.includes(cc)) {
    throw new GeoTargetingError(
      "UNSUPPORTED_COUNTRY",
      `Country "${cc}" is not enabled. Supported: ${allowed.join(", ")}.`
    );
  }

  if (geoTemplate()) return cc;

  const token = webshareToken();
  if (!token) {
    throw new GeoTargetingError(
      "GEO_NOT_CONFIGURED",
      "Geo-targeted rendering is temporarily unavailable."
    );
  }

  // Availability check against the (cached) proxy list — throws
  // UNSUPPORTED_COUNTRY when no exit exists for the country.
  const proxies = await getWebshareList(token);
  pickWebshareProxy(proxies, cc);
  return cc;
}

/**
 * Sticky-session id for gateway mode. Numeric-only: Webshare documents
 * numeric session ids (`{username}-us-1234`) and every other major gateway
 * (IPRoyal, Oxylabs, Bright Data) accepts them too — safest common
 * denominator.
 */
function sessionId(): string {
  return BigInt(`0x${randomBytes(8).toString("hex")}`).toString();
}

/**
 * Build the concrete proxy URL for one render. Gateway mode gets a unique
 * sticky session per attempt so concurrent renders don't share an exit IP
 * and retries land on a fresh one; Webshare direct mode picks a random
 * valid exit for the requested country.
 */
export async function buildGeoProxyUrl(rawCountry: string): Promise<string> {
  // Validation first (cheap + precise errors).
  const cc = normalizeCountry(rawCountry);
  if (!cc || !isIsoAlpha2(cc)) {
    throw new GeoTargetingError(
      "INVALID_COUNTRY",
      `"${rawCountry}" is not a valid ISO 3166-1 alpha-2 country code.`
    );
  }

  const tpl = geoTemplate();
  if (tpl) {
    const allowed = getAllowedCountries();
    if (allowed && !allowed.includes(cc)) {
      throw new GeoTargetingError(
        "UNSUPPORTED_COUNTRY",
        `Country "${cc}" is not enabled. Supported: ${allowed.join(", ")}.`
      );
    }
    const url = tpl
      .replaceAll("{country}", cc.toLowerCase())
      .replaceAll("{country_upper}", cc)
      .replaceAll("{session}", sessionId())
      .replaceAll("{random}", randomBytes(8).toString("hex"));

    // Fail closed on a misconfigured template rather than silently
    // rendering without the requested geography.
    try {
      const parsed = new URL(url);
      const scheme = parsed.protocol.replace(":", "");
      if (!["http", "https", "socks4", "socks5"].includes(scheme)) {
        throw new RangeError(`unsupported scheme: ${scheme}`);
      }
    } catch {
      throw new GeoTargetingError(
        "GEO_NOT_CONFIGURED",
        "GEO_PROXY_URL_TEMPLATE is not a valid proxy URL."
      );
    }
    return url;
  }

  const token = webshareToken();
  if (!token) {
    throw new GeoTargetingError(
      "GEO_NOT_CONFIGURED",
      "Geo-targeted rendering is temporarily unavailable."
    );
  }
  return buildWebshareProxyUrl(token, cc);
}
