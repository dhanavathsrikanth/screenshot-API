/**
 * Overlay CSS selectors applied after navigation so cookie walls, chat
 * widgets, and newsletter modals do not dominate the capture.
 *
 * Network-level ad/cookie blocking still comes from @cliqz/adblocker.
 * These selectors catch leftover DOM (CMP iframes, chat launchers).
 */

export const CONSENT_SELECTORS = [
  "#onetrust-banner-sdk",
  "#onetrust-consent-sdk",
  ".onetrust-pc-dark-filter",
  "#CybotCookiebotDialog",
  "#CybotCookiebotDialogBodyUnderlay",
  "#cookiebot-banner",
  ".qc-cmp2-container",
  ".qc-cmp-cleanslate",
  "#didomi-host",
  ".didomi-popup-container",
  "#usercentrics-root",
  "#usercentrics-cmp-ui",
  ".osano-cm-window",
  ".cc-window",
  ".cc-banner",
  "#iubenda-cs-banner",
  ".iubenda-cs-overlay",
  "#sp_message_container_1",
  "[id^='sp_message_container']",
  ".fc-consent-root",
  "#truste-consent-track",
  ".trustarc-banner-container",
  "#cookie-law-info-bar",
  ".cli-modal-backdrop",
  "#cookieConsent",
  ".cookie-consent",
  ".cookie-banner",
  "#gdpr-cookie-message",
  ".js-cookie-banner",
  "[data-testid='consent-banner']",
  "[aria-label='cookie consent']",
  "[aria-label='Cookie Consent Banner']",
];

export const NEWSLETTER_SELECTORS = [
  ".klaviyo-form-modal",
  ".klaviyo-close-form",
  "#klaviyo-toasts",
  ".needsclick.kl-private-reset-css-Xuajs1",
  "#om-modal",
  ".om-overlay",
  ".popup-overlay",
  ".mc-modal",
  "#mc_embed_signup",
  ".sumo-form-wrapper",
  ".poptin-popup",
  ".wisepops-popup",
  "[data-testid='newsletter-modal']",
  ".exit-intent-popup",
];

export const CHAT_SELECTORS = [
  ".crisp-client",
  "#intercom-container",
  ".intercom-lightweight-app",
  ".intercom-namespace",
  "#intercom-frame",
  ".tawk-min-container",
  "iframe.tawk-iframe",
  ".drift-widget",
  ".drift-frame-controller",
  ".fb_dialog",
  ".fb-customerchat",
  "#hubspot-messages-iframe-container",
  "#hubspot-conversations-iframe",
  ".zopim",
  ".livechat-widget",
  "#tidio-chat",
  "#tidio-chat-iframe",
  "#chat-widget-container",
  ".olark-launch-button",
  "#front-chat-iframe",
  "[data-testid='chat-widget']",
  "#zendesk-messenger-widget",
  "iframe[title='Opens a widget']",
];

export type CleanPreset = "default" | "strict" | "off";

export function overlaySelectorsFor(opts: {
  preset?: CleanPreset | null;
  blockCookieBanners: boolean;
  blockChats: boolean;
  hideSelectors?: string | null;
}): string[] {
  const preset = opts.preset ?? "default";
  const out: string[] = [];

  if (preset !== "off") {
    if (opts.blockCookieBanners) out.push(...CONSENT_SELECTORS);
    if (opts.blockChats) out.push(...CHAT_SELECTORS);
    if (preset === "strict" && opts.blockCookieBanners) {
      out.push(...NEWSLETTER_SELECTORS);
    }
  }

  if (opts.hideSelectors) {
    for (const raw of opts.hideSelectors.split(",")) {
      const token = raw.trim();
      if (!token) continue;
      if (token === "preset:consent") out.push(...CONSENT_SELECTORS);
      else if (token === "preset:newsletter") out.push(...NEWSLETTER_SELECTORS);
      else if (token === "preset:chat") out.push(...CHAT_SELECTORS);
      else out.push(token);
    }
  }

  return [...new Set(out)];
}
