import type { Page } from "puppeteer";
import { logger } from "@/lib/logger";

/** Most robust device + geo — mirrors vercel-labs/agent-browser:
 *  agent-browser set device "iPhone 14"
 *  agent-browser set viewport <w> <h> <scale>
 *  agent-browser set geo <lat> <lng>
 *  Falls back to Puppeteer CDP when agent-browser binary not present.
 */
const DEVICE_PRESETS: Record<string, { width: number; height: number; scale: number; userAgent: string; isMobile: boolean; hasTouch: boolean }> = {
  "iPhone 14": { width: 390, height: 844, scale: 3, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", isMobile: true, hasTouch: true },
  "iPhone 14 Pro": { width: 393, height: 852, scale: 3, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", isMobile: true, hasTouch: true },
  "Pixel 7": { width: 412, height: 915, scale: 3, userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", isMobile: true, hasTouch: true },
  "iPad Pro": { width: 1024, height: 1366, scale: 2, userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", isMobile: true, hasTouch: true },
};

const COUNTRY_GEO: Record<string, { lat: number; lng: number }> = {
  US: { lat: 37.7749, lng: -122.4194 }, GB: { lat: 51.5074, lng: -0.1278 }, DE: { lat: 52.52, lng: 13.405 }, JP: { lat: 35.6762, lng: 139.6503 },
  FR: { lat: 48.8566, lng: 2.3522 }, IN: { lat: 28.6139, lng: 77.209 }, BR: { lat: -23.5505, lng: -46.6333 }, CA: { lat: 43.6532, lng: -79.3832 },
  AU: { lat: -33.8688, lng: 151.2093 }, ES: { lat: 40.4168, lng: -3.7038 }, IT: { lat: 41.9028, lng: 12.4964 }, NL: { lat: 52.3676, lng: 4.9041 },
  PL: { lat: 52.2297, lng: 21.0122 }, SE: { lat: 59.3293, lng: 18.0686 }, AE: { lat: 25.2048, lng: 55.2708 }, SG: { lat: 1.3521, lng: 103.8198 },
  CH: { lat: 46.948, lng: 7.4474 }, MX: { lat: 19.4326, lng: -99.1332 }, KR: { lat: 37.5665, lng: 126.978 }, ID: { lat: -6.2088, lng: 106.8456 },
};

/** True when CDP geolocation override data exists for a country (any geo fallback). */
export function hasCdpGeo(countryCode: string): boolean {
  return Boolean(COUNTRY_GEO[countryCode.toUpperCase()]);
}

export async function applyRobustDeviceGeo(page: Page, opts: { is_mobile?: boolean; has_touch?: boolean; device?: string; viewport_width?: number; viewport_height?: number; device_scale_factor?: number; user_agent?: string; country?: string }): Promise<void> {
  try {
    // Device preset wins — like agent-browser set device
    if (opts.device && DEVICE_PRESETS[opts.device]) {
      const d = DEVICE_PRESETS[opts.device];
      await page.setUserAgent(d.userAgent).catch(() => {});
      await page.setViewport({ width: d.width, height: d.height, deviceScaleFactor: d.scale, isMobile: d.isMobile, hasTouch: d.hasTouch }).catch(() => {});
      // CDP robust: Emulation.setDeviceMetricsOverride
      try {
        const cdp = await page.createCDPSession();
        await cdp.send("Emulation.setDeviceMetricsOverride", { width: d.width, height: d.height, deviceScaleFactor: d.scale, mobile: d.isMobile } as never);
        await cdp.detach().catch(() => {});
      } catch {}
      logger.info({ event: "robust_device_applied", device: opts.device });
      return;
    }
    // Viewport + mobile/touch + UA — most robust combo
    const isMobile = !!opts.is_mobile;
    const hasTouch = !!opts.has_touch || isMobile;
    if (isMobile || hasTouch || opts.viewport_width || opts.device_scale_factor || opts.user_agent) {
      const width = opts.viewport_width ?? 1280;
      const height = opts.viewport_height ?? 720;
      const scale = opts.device_scale_factor ?? (isMobile ? 2 : 1);
      if (opts.user_agent) await page.setUserAgent(opts.user_agent).catch(() => {});
      await page.setViewport({ width, height, deviceScaleFactor: scale, isMobile, hasTouch }).catch(() => {});
      try {
        const cdp = await page.createCDPSession();
        await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: isMobile } as never);
        if (hasTouch) await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true } as never);
        await cdp.detach().catch(() => {});
      } catch {}
    }
    // Geo — like agent-browser set geo <lat> <lng> + grant geolocation
    if (opts.country) {
      const geo = COUNTRY_GEO[opts.country.toUpperCase()];
      if (geo) {
        try {
          const ctx = page.browserContext();
          await ctx.overridePermissions(page.url() || "https://example.com", ["geolocation"]).catch(() => ctx.overridePermissions("https://example.com", ["geolocation"]).catch(() => {}));
        } catch {}
        await page.setGeolocation({ latitude: geo.lat, longitude: geo.lng }).catch(() => {});
        logger.info({ event: "robust_geo_applied", country: opts.country, geo });
      }
    }
  } catch (e) {
    logger.warn({ event: "robust_device_geo_failed", error: e instanceof Error ? e.message : String(e) });
  }
}
