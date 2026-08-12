import type { Metadata } from "next";
import {
  LegalPage,
  LegalSection,
  LegalParagraph,
  LegalJsonLd,
} from "@/components/legal/legal-page";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service - ScreenshotAPI",
  description: "The terms that govern your use of the ScreenshotAPI service.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service - ScreenshotAPI",
    description: "The terms that govern your use of the ScreenshotAPI service.",
    url: "/terms",
    siteName: siteConfig.name,
    locale: "en_US",
    type: "website",
  },
};

const UPDATED_ISO = "2026-08-11";
const UPDATED_LABEL = "August 11, 2026";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updatedIso={UPDATED_ISO} updatedLabel={UPDATED_LABEL}>
      <LegalJsonLd
        title="Terms of Service - ScreenshotAPI"
        description="The terms that govern your use of the ScreenshotAPI service."
        path="/terms"
        updatedIso={UPDATED_ISO}
      />

      <LegalSection heading="1. Agreement to These Terms">
        <LegalParagraph>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of
          the ScreenshotAPI website, dashboard, and screenshot API (the
          &quot;Service&quot;). By creating an account or using the Service, you agree
          to these Terms. If you do not agree, do not use the Service.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Eligibility">
        <LegalParagraph>
          You must be at least 18 years old, or the age of majority in your
          jurisdiction, to use the Service. By using the Service you represent
          that you meet this requirement. If you use the Service on behalf of
          an organization, you represent that you have authority to bind that
          organization.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="3. The Service">
        <LegalParagraph>
          The Service renders screenshots of websites and HTML content through
          an API, and provides a dashboard to manage your account, API keys,
          and plan. Usage is governed by the limits of your plan, including
          monthly screenshot quotas, rate limits, and available features, as
          described on the Pricing page and in the API documentation.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="4. Accounts and Registration">
        <LegalParagraph>
          You are responsible for maintaining the confidentiality of your
          account credentials and API keys and for all activity that occurs
          under them. You agree to provide accurate information at
          registration and to keep it up to date. API keys are secrets: do
          not share or expose them.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="5. Acceptable Use">
        <LegalParagraph>
          You must not use the Service for any unlawful, abusive, or
          infringing purpose. Your use of the Service must comply with our{" "}
          <a
            href="/aup"
            className="text-[var(--primary)] underline underline-offset-4"
          >
            Acceptable Use Policy
          </a>
          , which is incorporated into these Terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. Fees, Billing, and Payment">
        <LegalParagraph>
          Paid plans are billed on a recurring monthly basis. All payments are
          processed by Dodo Payments, our merchant of record. You authorize us
          (through Dodo Payments) to charge the payment method on file for all
          fees associated with your plan. Subscriptions renew automatically
          until cancelled. You can cancel your subscription from the dashboard
          at any time; cancellation takes effect at the end of the current
          billing period. Fees may be subject to applicable taxes. We may
          update pricing for plans with reasonable notice, as described on the
          Pricing page.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="7. Refunds">
        <LegalParagraph>
          Refunds are governed by our{" "}
          <a
            href="/refunds"
            className="text-[var(--primary)] underline underline-offset-4"
          >
            Refund Policy
          </a>
          , which is incorporated into these Terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="8. User Content and Screenshots">
        <LegalParagraph>
          You retain all rights in the content you submit to the Service and
          in the screenshots you capture. You are solely responsible for
          ensuring that you have the right to capture, store, and use content
          from any website you submit, and that your use complies with the
          target website&apos;s terms and applicable law. Screenshots may contain
          content owned by third parties, and you are responsible for your use
          of that content.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="9. Intellectual Property">
        <LegalParagraph>
          The Service, including the website, documentation, API, software,
          and branding, is owned by us and protected by intellectual property
          laws. Except as expressly permitted, you may not copy, modify,
          distribute, or reverse engineer any part of the Service.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="10. Disclaimers">
        <LegalParagraph>
          The Service is provided &quot;as is&quot; and &quot;as available&quot; without
          warranties of any kind, express or implied, including warranties of
          merchantability, fitness for a particular purpose, and
          non-infringement. We do not warrant that the Service will be
          uninterrupted, error-free, or that rendering of any particular
          website will succeed, as target websites may block automated
          access.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="11. Limitation of Liability">
        <LegalParagraph>
          To the maximum extent permitted by law, we will not be liable for
          any indirect, incidental, special, consequential, or punitive
          damages, or for any loss of profits, data, or goodwill, arising out
          of or related to your use of the Service. Our total aggregate
          liability for all claims arising from the Service will not exceed
          the amounts you paid to us in the three months preceding the claim.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="12. Indemnification">
        <LegalParagraph>
          You agree to indemnify and hold us harmless from and against any
          claims, damages, liabilities, and expenses arising out of your use
          of the Service, your violation of these Terms, or your violation of
          any rights of a third party, including claims relating to content
          you capture.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="13. Termination">
        <LegalParagraph>
          You may stop using the Service at any time and delete your account.
          We may suspend or terminate your access to the Service, in whole or
          in part, at any time if you breach these Terms or our Acceptable Use
          Policy, if your payment fails, or if we determine that doing so is
          necessary to protect the Service or other users. Upon termination,
          paid fees already charged for the current billing period are not
          refunded except as described in our Refund Policy.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="14. Changes to These Terms">
        <LegalParagraph>
          We may update these Terms from time to time. Material changes will
          be posted on this page with an updated &quot;Last updated&quot; date.
          Continued use of the Service after changes take effect constitutes
          acceptance of the revised Terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="15. Governing Law">
        <LegalParagraph>
          These Terms are governed by the laws of the country in which the
          operator of the Service is established, without regard to conflict
          of laws principles. Any disputes arising out of or relating to these
          Terms will be resolved in the competent courts of that country.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="16. Contact Us">
        <LegalParagraph>
          If you have questions about these Terms, email us at{" "}
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
