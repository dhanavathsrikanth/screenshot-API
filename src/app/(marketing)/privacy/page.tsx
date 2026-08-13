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
  title: "Privacy Policy - ScreenshotAPI",
  description:
    "How ScreenshotAPI collects, uses, and protects your personal data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy - ScreenshotAPI",
    description:
      "How ScreenshotAPI collects, uses, and protects your personal data.",
    url: "/privacy",
    siteName: siteConfig.name,
    locale: "en_US",
    type: "website",
  },
};

const UPDATED_ISO = "2026-08-11";
const UPDATED_LABEL = "August 11, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updatedIso={UPDATED_ISO} updatedLabel={UPDATED_LABEL}>
      <LegalJsonLd
        title="Privacy Policy - ScreenshotAPI"
        description="How ScreenshotAPI collects, uses, and protects your personal data."
        path="/privacy"
        updatedIso={UPDATED_ISO}
      />

      <LegalSection heading="1. Overview">
        <LegalParagraph>
          This Privacy Policy explains how ScreenshotAPI (&quot;we&quot;, &quot;us&quot;, or
          &quot;our&quot;) collects, uses, and protects information when you use our
          website, dashboard, and screenshot API (collectively, the
          &quot;Service&quot;). By using the Service, you agree to the practices
          described in this policy.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Information We Collect">
        <LegalParagraph>We collect the following categories of information:</LegalParagraph>
        <LegalList
          items={[
            <span key="account">
              <strong className="text-zinc-900 dark:text-zinc-100">Account information.</strong>{" "}
              Your name, email address, and profile details when you create an
              account. Authentication is handled by our provider Clerk, and we
              never see or store your password.
            </span>,
            <span key="billing">
              <strong className="text-zinc-900 dark:text-zinc-100">Payment information.</strong>{" "}
              Billing and payment card details are collected and processed by
              our payments partner Dodo Payments, who acts as merchant of
              record. We do not store full payment card numbers on our
              servers.
            </span>,
            <span key="usage">
              <strong className="text-zinc-900 dark:text-zinc-100">API usage data.</strong>{" "}
              The API keys you create, the URLs and HTML you submit for
              screenshots, request timestamps, response statuses, and
              per-request metadata. We use this data to enforce your plan&apos;s
              quotas, bill usage, and detect abuse.
            </span>,
            <span key="auto">
              <strong className="text-zinc-900 dark:text-zinc-100">Automatically collected data.</strong>{" "}
              IP address, browser and device information, and aggregate
              analytics about how the Service is used, collected through
              Vercel Analytics.
            </span>,
            <span key="local">
              <strong className="text-zinc-900 dark:text-zinc-100">Local storage.</strong>{" "}
              Your cookie banner choice (accept all, or essential only) is
              stored in your browser&apos;s local storage so the banner
              does not reappear on every visit. We also record aggregate,
              non-identifying banner events (banner shown, accepted, or
              essential only) so we can understand how visitors respond to the
              banner. See our Cookie Policy for details.
            </span>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. How We Use Your Information">
        <LegalParagraph>We use your information to:</LegalParagraph>
        <LegalList
          items={[
            "Provide, operate, and maintain your account and the Service",
            "Authenticate you and secure your account",
            "Process payments, subscriptions, and refunds through Dodo Payments",
            "Enforce plan quotas, rate limits, and our Acceptable Use Policy",
            "Prevent abuse, fraud, and security incidents",
            "Improve the Service through aggregate analytics",
            "Comply with legal obligations",
            "Communicate with you about your account, billing, and the Service",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. How We Handle Screenshot Requests">
        <LegalParagraph>
          When you submit a URL or HTML to our API, our rendering
          infrastructure fetches the target website and returns the rendered
          output in the requested format. The content of the websites you
          capture is delivered to you; we do not review screenshots except to
          detect abuse or enforce our Acceptable Use Policy. Rendered files are
          written directly to our R2 bucket and retained for a limited time
          depending on your plan (24 hours on Free, 30 days on Starter, 90 days
          on Pro). Request metadata is retained for billing, quota, and
          abuse-prevention purposes. We do not sell your data.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="5. Cookies and Similar Technologies">
        <LegalParagraph>
          We use cookies and similar technologies to authenticate you and to
          operate the Service. Vercel Analytics collects limited, aggregate
          usage statistics. You can manage cookies in your browser settings;
          blocking essential cookies may prevent you from signing in. See our{" "}
          <a
            href="/cookies"
            className="text-[var(--primary)] underline underline-offset-4"
          >
            Cookie Policy
          </a>{" "}
          for full details.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. Data Sharing and Third-Party Processors">
        <LegalParagraph>
          We share information only with the processors required to operate
          the Service, and only to the extent necessary:
        </LegalParagraph>
        <LegalList
          items={[
            <span key="clerk">
              <strong className="text-zinc-900 dark:text-zinc-100">Clerk</strong>{" "}
              - authentication and user management
            </span>,
            <span key="vercel">
              <strong className="text-zinc-900 dark:text-zinc-100">Vercel</strong>{" "}
              - hosting and analytics
            </span>,
            <span key="supabase">
              <strong className="text-zinc-900 dark:text-zinc-100">Supabase</strong>{" "}
              - application database
            </span>,
            <span key="upstash">
              <strong className="text-zinc-900 dark:text-zinc-100">Upstash</strong>{" "}
              - rate limiting and caching
            </span>,
            <span key="dodo">
              <strong className="text-zinc-900 dark:text-zinc-100">Dodo Payments</strong>{" "}
              - payment processing, subscriptions, and billing (merchant of
              record). See{" "}
              <a
                href="https://www.dodopayments.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--primary)] underline underline-offset-4"
              >
                Dodo&apos;s Privacy Policy
              </a>
              .
            </span>,
            <span key="aws">
              <strong className="text-zinc-900 dark:text-zinc-100">Amazon Web Services (S3)</strong>{" "}
              - cloud storage, only when you enable it on your account
            </span>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="7. Legal Bases for Processing (GDPR)">
        <LegalParagraph>
          For users in the European Economic Area or the United Kingdom, we
          process personal data on the following legal bases: performance of a
          contract with you; our legitimate interests in operating and
          securing the Service; compliance with legal obligations; and
          consent, where you have given it.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="8. Data Retention">
        <LegalParagraph>
          We retain account data for as long as your account is active and for
          a reasonable period afterwards (up to 30 days) to process pending
          transactions, satisfy legal obligations, and prevent fraud. Usage
          and billing records are retained in accordance with applicable tax
          and accounting laws.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="9. Data Security">
        <LegalParagraph>
          We take reasonable technical and organizational measures to protect
          your data, including encryption in transit, encryption at rest,
          access controls, and regular security reviews. No method of
          transmission or storage is completely secure, and we cannot
          guarantee absolute security.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="10. International Data Transfers">
        <LegalParagraph>
          Your data may be processed in jurisdictions other than your own,
          including the United States and the European Union. Where transfers
          are subject to the GDPR, we rely on appropriate safeguards, such as
          Standard Contractual Clauses, or equivalent mechanisms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="11. Your Privacy Rights">
        <LegalParagraph>
          Depending on where you live, you may have the right to access,
          correct, delete, or port your personal data; to object to or
          restrict certain processing; and to withdraw consent at any time.
          California residents have similar rights under the CCPA/CPRA; we do
          not sell personal data. To exercise any of these rights, contact us
          at {siteConfig.email}.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="12. Children's Privacy">
        <LegalParagraph>
          The Service is not intended for children under 16 (or 13, where
          local law provides otherwise), and we do not knowingly collect
          personal data from children. If you believe a child has provided us
          with personal data, contact us and we will delete it.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="13. Changes to This Policy">
        <LegalParagraph>
          We may update this Privacy Policy from time to time. Material
          changes will be posted on this page with an updated &quot;Last updated&quot;
          date. Continued use of the Service after changes take effect
          constitutes acceptance of the revised policy.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="14. Contact Us">
        <LegalParagraph>
          If you have questions about this Privacy Policy or your data, email
          us at{" "}
          <a
            href={`mailto:${siteConfig.email}`}
            className="text-[var(--primary)] underline underline-offset-4"
          >
            {siteConfig.email}
          </a>
          . For payment-related data, you may also contact Dodo Payments
          directly through their support channels.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
