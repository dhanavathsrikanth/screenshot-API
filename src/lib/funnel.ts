import posthog from "posthog-js";

export const FUNNEL_EVENTS = {
  landingViewed: "landing_view",
  pricingViewed: "pricing_viewed",
  docsViewed: "docs_viewed",
  freeToolsViewed: "free_tools_viewed",
  signupPageViewed: "signup_page_viewed",
  guideViewed: "guide_viewed",
  comparisonViewed: "comparison_viewed",
  demoCaptured: "demo_capture_succeeded",
  demoFailed: "demo_capture_failed",
  ctaClicked: "cta_clicked",
  codeCopied: "code_copied",
  freeToolCaptured: "free_tool_captured",
  contactFormSubmitted: "contact_form_submitted",
  checkoutStarted: "checkout_started",
  signupCompleted: "signup_completed",
  subscriptionCreated: "subscription_created",
  firstApiRequest: "first_api_request",
  firstScreenshotCompleted: "first_screenshot_completed",
  tenthScreenshot: "10th_screenshot",
  paymentSucceeded: "payment_succeeded",
} as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS];

export function captureClientFunnel(
  event: FunnelEventName,
  properties?: Record<string, unknown>
): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || !posthog.__loaded) return;
  posthog.capture(event, properties);
}
