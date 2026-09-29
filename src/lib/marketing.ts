/** Shared positioning and upgrade copy — keep marketing and dashboard aligned. */

export const positioning = {
  headline: "Ship website captures without running browsers",
  subhead:
    "One API turns public pages into clean screenshots and PDFs. Cookie banners, ads, and chat overlays are handled automatically. Full-page capture and PDF are included in the 100 free monthly credits.",
  freeOffer: "100 free credits each month — full-page and PDF included",
  starterOffer: "Starter $9: 2,500 monthly captures and 30-day history",
} as const;

export const upgradeReasons = {
  starter: [
    "2,500 credits/month vs 100 on Free",
    "Longer capture delays (up to 30 seconds)",
    "30-day history instead of 24 hours",
    "Priority queue ahead of free traffic",
  ],
  pro: [
    "15,000 credits/month for production volume",
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
      "Use your Free credits for full-page captures and PDFs, then move to Starter for more monthly volume and longer history.",
    paysFor: "Starter for volume and history",
  },
  {
    title: "AI agents & MCP",
    audience: "Cursor, Claude, and internal bots",
    description:
      "Give an agent a screenshot, element capture, or Markdown extract of a URL without teaching it to drive a browser.",
    paysFor: "Pro when agents run in production",
  },
] as const;
