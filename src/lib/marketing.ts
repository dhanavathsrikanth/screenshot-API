/** Shared positioning and upgrade copy — keep marketing and dashboard aligned. */

export const positioning = {
  headline: "Clean screenshots for your product, one API call",
  subhead:
    "Built for indie SaaS, link previews, docs, and AI agents. Ads, cookie banners, and chat widgets are stripped by default — no Chromium farm to run.",
  freeOffer: "100 free viewport captures / month — no credit card",
  starterOffer: "Starter $9: full-page, PDF, 2,500 captures, 30-day history",
} as const;

export const upgradeReasons = {
  starter: [
    "Full-page screenshots (entire scrollable page)",
    "PDF export for reports and archives",
    "2,500 captures/month vs 100 on Free",
    "30-day history instead of 24 hours",
    "Priority queue ahead of free traffic",
  ],
  pro: [
    "15,000 captures/month for production volume",
    "Geo-targeted rendering by country",
    "Cloud storage (R2) for direct asset URLs",
    "90-day screenshot retention",
  ],
} as const;

/** Honest competitor framing for pricing pages — verify prices periodically. */
export const competitorSnapshot = [
  { name: "ScreenshotAPI Starter", price: "$9/mo", volume: "2,500", note: "Full-page + PDF included" },
  { name: "ScreenshotOne Basic", price: "$17/mo", volume: "2,000", note: "Ad blocking on paid plans" },
  { name: "Urlbox Hi-Fi", price: "$49/mo", volume: "5,000", note: "No permanent free tier" },
] as const;

export const useCases = [
  {
    title: "Link previews & OG images",
    audience: "SaaS and content products",
    description:
      "Render a live URL into a thumbnail without standing up Puppeteer. Cookie banners stay off the card your users see.",
    paysFor: "Starter when previews ship to users",
  },
  {
    title: "Docs, changelogs, and reports",
    audience: "Product and support teams",
    description:
      "Full-page captures and PDFs on Starter ($9) so you can archive a page as it looked — not a cropped viewport.",
    paysFor: "Starter for PDF + full-page",
  },
  {
    title: "AI agents & MCP",
    audience: "Cursor, Claude, and internal bots",
    description:
      "Give an agent a screenshot, element capture, or Markdown extract of a URL without teaching it to drive a browser.",
    paysFor: "Pro when agents run in production",
  },
] as const;
