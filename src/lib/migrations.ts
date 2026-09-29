export type MigrationGuide = {
  slug: "screenshotone" | "urlbox";
  competitor: string;
  domain: string;
  title: string;
  description: string;
  fromHost: string;
  notes: string[];
  params: { them: string; us: string; note: string }[];
};

export const migrationGuides: MigrationGuide[] = [
  {
    slug: "screenshotone",
    competitor: "ScreenshotOne",
    domain: "screenshotone.com",
    title: "Migrate from ScreenshotOne",
    description:
      "Swap the host, map a few query names, and keep ads/cookie blocking on by default. Free includes 100 credits with full-page and PDF; Starter is $9 for 2,500 monthly credits and 30-day history.",
    fromHost: "https://api.screenshotone.com/take",
    notes: [
      "Authenticate with Authorization: Bearer sk_live_… (or x-api-key). For <img> / OG tags, HMAC-sign GET /api/take with access_key + signing secret.",
      "Ads, cookie banners, trackers, and chat widgets are blocked unless you set the matching block_* flag to false.",
      "Successful cache hits count toward credits; failed renders are refunded.",
      "For OG tags and <img src>, sign GET /api/take (see /docs/signed-urls). Do not put sk_live_ in the page.",
    ],
    params: [
      { them: "url", us: "url", note: "Same. Scheme-less URLs get https://." },
      { them: "format / image_quality", us: "format / quality", note: "png, jpeg, webp, pdf on every plan; PDF costs 5 credits per page." },
      { them: "full_page", us: "full_page", note: "Included on Free and paid plans." },
      { them: "viewport_width / viewport_height", us: "viewport_width / viewport_height", note: "Same." },
      { them: "device_scale_factor", us: "device_scale_factor", note: "1–3." },
      { them: "selector", us: "selector", note: "Element capture is on Free." },
      { them: "wait_until / delay", us: "wait_until / delay / wait_for_selector", note: "Prefer wait_for_selector for SPAs." },
      { them: "block_ads / block_cookie_banners", us: "block_ads / block_cookie_banners (default true)", note: "Set false for compliance archives." },
      { them: "dark_mode", us: "dark_mode", note: "Same." },
      { them: "geolocation / ip_country", us: "country", note: "ISO 3166-1 alpha-2. Pro+." },
      { them: "async + webhook", us: "POST /api/v1/screenshots + webhooks", note: "Poll GET /api/v1/screenshots/{id}." },
      { them: "cache", us: "Automatic CDN/R2 cache", note: "Identical options share a cache entry." },
    ],
  },
  {
    slug: "urlbox",
    competitor: "Urlbox",
    domain: "urlbox.com",
    title: "Migrate from Urlbox",
    description:
      "Urlbox Lo-Fi is reduced quality, not just fewer shots. ScreenshotAPI includes full-page and PDF in the permanent Free plan; Starter ($9) adds volume and 30-day history.",
    fromHost: "https://api.urlbox.io/v1/render/sync",
    notes: [
      "No URL signing required for server-side calls — use Bearer API keys.",
      "There is a permanent Free plan (100 credits/month), not only a time-boxed trial.",
      "Default captures hide cookie banners and chat widgets. Set block_cookie_banners=false if you need the banner in frame.",
      "Video/GIF is Scale ($79), not the first paid tier.",
    ],
    params: [
      { them: "url", us: "url", note: "Same." },
      { them: "format", us: "format", note: "png, jpeg, webp, pdf on every plan; PDF costs 5 credits per page." },
      { them: "full_page", us: "full_page", note: "Included on Free and paid plans." },
      { them: "width / height", us: "viewport_width / viewport_height", note: "Rename." },
      { them: "retina / dpr", us: "device_scale_factor", note: "Integer 1–3." },
      { them: "selector", us: "selector", note: "On Free." },
      { them: "hide_cookie_banners / block_ads", us: "block_cookie_banners / block_ads (default true)", note: "Defaults are inverted vs many Urlbox examples." },
      { them: "user_agent", us: "user_agent", note: "Same." },
      { them: "wait_for / delay", us: "wait_for_selector / delay", note: "Use wait_for_selector for SPAs." },
      { them: "thumb_width", us: "thumbnail_width (v1)", note: "POST /api/v1/screenshots." },
      { them: "webhook_url", us: "Dashboard webhooks or POST /api/v1/webhooks", note: "HMAC in x-webhook-signature." },
      { them: "s3 upload", us: "Project customer bucket (Pro+)", note: "S3, R2, or GCS HMAC. See /docs/customer-upload." },
    ],
  },
];

export function getMigration(slug: string): MigrationGuide | undefined {
  return migrationGuides.find((g) => g.slug === slug);
}
