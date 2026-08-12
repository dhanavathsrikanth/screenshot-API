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
  title: "Acceptable Use Policy - ScreenshotAPI",
  description:
    "The rules for using the ScreenshotAPI service, and what is not allowed.",
  alternates: { canonical: "/aup" },
  openGraph: {
    title: "Acceptable Use Policy - ScreenshotAPI",
    description:
      "The rules for using the ScreenshotAPI service, and what is not allowed.",
    url: "/aup",
    siteName: siteConfig.name,
    locale: "en_US",
    type: "website",
  },
};

const UPDATED_ISO = "2026-08-11";
const UPDATED_LABEL = "August 11, 2026";

export default function AupPage() {
  return (
    <LegalPage title="Acceptable Use Policy" updatedIso={UPDATED_ISO} updatedLabel={UPDATED_LABEL}>
      <LegalJsonLd
        title="Acceptable Use Policy - ScreenshotAPI"
        description="The rules for using the ScreenshotAPI service, and what is not allowed."
        path="/aup"
        updatedIso={UPDATED_ISO}
      />

      <LegalSection heading="1. Purpose">
        <LegalParagraph>
          This Acceptable Use Policy (&quot;AUP&quot;) sets out the rules for using the
          ScreenshotAPI service (the &quot;Service&quot;). It applies to all users and
          is incorporated into our Terms of Service. By using the Service you
          agree to comply with this policy.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Prohibited Content">
        <LegalParagraph>
          You may not use the Service to capture, store, or distribute content
          that:
        </LegalParagraph>
        <LegalList
          items={[
            "is illegal, defamatory, harassing, or hateful",
            "depicts child sexual abuse material (CSAM) or other exploitation of minors",
            "promotes violence, terrorism, weapons, or illegal drugs",
            "contains malware, phishing, or other malicious content",
            "infringes the intellectual property or other rights of third parties",
            "discloses personal or confidential information of others without authorization",
            "circumvents authentication, paywalls, or digital restrictions that you are not authorized to access",
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Prohibited Conduct">
        <LegalParagraph>
          You may not use the Service to:
        </LegalParagraph>
        <LegalList
          items={[
            "attempt to overload, degrade, or gain unauthorized access to the Service or our infrastructure",
            "use automated methods to consume your quota beyond your plan's limits or to evade rate limits",
            "attack, probe, or exploit other websites using our infrastructure",
            "harvest or scrape websites in a way that violates their terms of service or applicable law",
            "send spam or use the Service to facilitate fraud",
            "resell the Service or provide it to third parties as a service without a written agreement with us",
            "use the Service to test or screen content for purposes prohibited by law",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Lawful Use of Target Websites">
        <LegalParagraph>
          You are responsible for ensuring that you have the right to capture
          content from any website or HTML you submit to the Service, and that
          your use complies with the target website&apos;s terms of service and all
          applicable laws and regulations, including in the jurisdiction where
          the target website is located.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="5. Enforcement">
        <LegalParagraph>
          We may investigate suspected violations of this policy and take
          action we deem appropriate, including removing content, suspending
          or terminating accounts, and cooperating with law enforcement. You
          acknowledge that we may terminate your access for violating this
          policy, without refund except as provided in our Refund Policy.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. Reporting Abuse">
        <LegalParagraph>
          To report a violation of this policy, email us at{" "}
          <a
            href={`mailto:${siteConfig.email}`}
            className="text-[var(--primary)] underline underline-offset-4"
          >
            {siteConfig.email}
          </a>{" "}
          with details about the account and the suspected violation.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="7. Changes to This Policy">
        <LegalParagraph>
          We may update this Acceptable Use Policy from time to time. Any
          changes will be posted on this page with an updated &quot;Last updated&quot;
          date.
        </LegalParagraph>
      </LegalSection>
    </LegalPage>
  );
}
