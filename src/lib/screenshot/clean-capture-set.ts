/** Public challenge set for clean-capture quality. Overlay labels are what we hide by default. */

export const CLEAN_CAPTURE_SET: {
  url: string;
  overlay: "consent" | "ads" | "chat" | "newsletter" | "lazy" | "mixed";
  note: string;
}[] = [
  { url: "https://www.bbc.com", overlay: "consent", note: "CMP / regional cookie wall" },
  { url: "https://www.theguardian.com", overlay: "consent", note: "Consent + ads" },
  { url: "https://www.nytimes.com", overlay: "consent", note: "Meter / consent overlay" },
  { url: "https://www.cnn.com", overlay: "ads", note: "Heavy ad units" },
  { url: "https://www.forbes.com", overlay: "consent", note: "Consent + newsletter" },
  { url: "https://www.wired.com", overlay: "consent", note: "Condé Nast CMP" },
  { url: "https://techcrunch.com", overlay: "ads", note: "Display ads + newsletter" },
  { url: "https://www.reddit.com", overlay: "consent", note: "Cookie / app promo" },
  { url: "https://stackoverflow.com", overlay: "consent", note: "OneTrust-style banner" },
  { url: "https://www.amazon.com", overlay: "lazy", note: "Lazy images, tall page" },
  { url: "https://www.ebay.com", overlay: "consent", note: "Regional cookie banner" },
  { url: "https://www.booking.com", overlay: "consent", note: "CMP + currency prompts" },
  { url: "https://www.airbnb.com", overlay: "consent", note: "Cookie banner" },
  { url: "https://www.ikea.com", overlay: "consent", note: "Regional CMP" },
  { url: "https://www.nike.com", overlay: "newsletter", note: "Promo / geo overlays" },
  { url: "https://www.spotify.com", overlay: "consent", note: "Cookie banner" },
  { url: "https://www.netflix.com", overlay: "consent", note: "Locale / cookie" },
  { url: "https://www.youtube.com", overlay: "consent", note: "Consent wall (EU)" },
  { url: "https://www.linkedin.com", overlay: "consent", note: "Auth + cookie wall" },
  { url: "https://x.com", overlay: "consent", note: "Cookie / login interstitial" },
  { url: "https://www.instagram.com", overlay: "consent", note: "Login overlay" },
  { url: "https://www.hubspot.com", overlay: "chat", note: "HubSpot conversations widget" },
  { url: "https://www.intercom.com", overlay: "chat", note: "Intercom launcher" },
  { url: "https://www.zendesk.com", overlay: "chat", note: "Messaging widget" },
  { url: "https://www.shopify.com", overlay: "consent", note: "Cookie + marketing popups" },
  { url: "https://stripe.com", overlay: "lazy", note: "Long marketing page, lazy media" },
  { url: "https://vercel.com", overlay: "lazy", note: "JS-heavy marketing" },
  { url: "https://github.com", overlay: "lazy", note: "Should stay clean (control)" },
  { url: "https://example.com", overlay: "lazy", note: "Control — no overlays" },
  { url: "https://news.ycombinator.com", overlay: "lazy", note: "Control — minimal chrome" },
];
