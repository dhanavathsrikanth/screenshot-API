import type { Metadata } from "next";
import {
  LegalPage,
  LegalSection,
  LegalParagraph,
  LegalList,
  LegalJsonLd,
} from "@/components/legal/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund Policy - ScreenshotAPI",
  description: "Refund and cancellation terms for ScreenshotAPI subscriptions.",
  alternates: { canonical: "/refunds" },
  openGraph: {
    title: "Refund Policy - ScreenshotAPI",
    description: "Refund and cancellation terms for ScreenshotAPI subscriptions.",
    url: "/refunds",
    siteName: siteConfig.name,
    locale: "en_US",
    type: "website",
  },
};

const UPDATED_ISO = "2026-08-11";
const UPDATED_LABEL = "August 11, 2026";

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" updatedIso={UPDATED_ISO} updatedLabel={UPDATED_LABEL}>
      <LegalJsonLd
        title="Refund Policy - ScreenshotAPI"
        description="Refund and cancellation terms for ScreenshotAPI subscriptions."
        path="/refunds"
        updatedIso={UPDATED_ISO}
      />

      <LegalSection heading="1. Overview">
        <LegalParagraph>
          This Refund Policy explains how cancellations, billing errors, and
          refunds are handled for the ScreenshotAPI service. All payments are
          processed by our merchant of record, Dodo Payments.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Subscription Billing">
        <LegalParagraph>
          Paid plans are billed monthly in advance and renew automatically at
          the start of each billing period. You can cancel your subscription
          at any time from the dashboard. Cancellation stops all future
          billing, and your plan remains active until the end of the current
          billing period you have already paid for.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="3. No Refunds">
        <LegalParagraph>
          All fees paid for the Service are final and non-refundable. We do
          not provide refunds or credits, including for:
        </LegalParagraph>
        <LegalList
          items={[
            "partially used billing periods",
            "unused screenshot quota or unused API usage",
            "voluntary cancellation of a subscription",
            "plan changes or downgrades made during a billing period",
            "accounts suspended or terminated for violating our Terms of Service or Acceptable Use Policy",
          ]}
        />
        <LegalParagraph>
          Because plans are billed in advance for the full billing period,
          cancelling before the end of that period does not entitle you to a
          refund or credit for the remaining days.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="4. Billing Errors">
        <LegalParagraph>
          If you believe you were charged in error, or if a duplicate or
          incorrect charge was made, contact us within 30 days of the charge
          and we will investigate. Erroneous or duplicate charges will be
          corrected or refunded in full.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="5. Chargebacks">
        <LegalParagraph>
          If you dispute a charge with your bank before contacting us, the
          dispute is handled by Dodo Payments. We encourage you to contact us
          first so we can resolve any issue directly, which is usually faster
          than a chargeback.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. Statutory Consumer Rights">
        <LegalParagraph>
          Nothing in this Refund Policy limits rights you may have under
          applicable consumer protection laws in your country that cannot be
          waived by agreement. Where such laws apply, you may have a right to
          cancel or obtain a refund within a statutory period.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="7. Contact Us">
        <LegalParagraph>
          If you have questions about this Refund Policy, or believe you were
          charged in error, email us at{" "}
          <a
            href={`mailto:${siteConfig.email}`}
            className="text-[var(--primary)] underline underline-offset-4"
          >
            {siteConfig.email}
          </a>
          .
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
