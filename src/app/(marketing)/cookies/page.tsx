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
  title: "Cookie Policy - ScreenshotAPI",
  description: "How ScreenshotAPI uses cookies and similar technologies.",
  alternates: { canonical: "/cookies" },
  openGraph: {
    title: "Cookie Policy - ScreenshotAPI",
    description: "How ScreenshotAPI uses cookies and similar technologies.",
    url: "/cookies",
    siteName: siteConfig.name,
    locale: "en_US",
    type: "website",
  },
};

const UPDATED_ISO = "2026-08-11";
const UPDATED_LABEL = "August 11, 2026";

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" updatedIso={UPDATED_ISO} updatedLabel={UPDATED_LABEL}>
      <LegalJsonLd
        title="Cookie Policy - ScreenshotAPI"
        description="How ScreenshotAPI uses cookies and similar technologies."
        path="/cookies"
        updatedIso={UPDATED_ISO}
      />

      <LegalSection heading="1. What Are Cookies">
        <LegalParagraph>
          Cookies are small text files stored on your device by a website so
          it can recognize you on return visits. This policy also covers
          similar technologies such as local storage, which works in a similar
          way.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Cookies We Use">
        <LegalParagraph>
          We use a limited set of cookies and local storage to make the
          Service work:
        </LegalParagraph>
        <LegalList
          items={[
            <span key="essential">
              <strong className="text-zinc-900 dark:text-zinc-100">Essential cookies.</strong>{" "}
              Set by Clerk to keep you signed in and secure your session
              (for example the &quot;__session&quot; cookie). Without these,
              you cannot log in to the dashboard. They are first-party and
              expire when you log out or after your session ends. The
              &quot;screenshotapi_consent&quot; cookie, which records your
              cookie choice below, is also essential so the banner does not
              reappear on every page.
            </span>,
            <span key="analytics">
              <strong className="text-zinc-900 dark:text-zinc-100">Analytics.</strong>{" "}
              Vercel Analytics collects limited, aggregate usage data (such as
              page views and approximate location) to help us understand how
              the Service is used. It does not track you across other
              websites, uses no cookies, and is only loaded after you accept
              optional analytics through the cookie banner.
            </span>,
          ]}
        />
      </LegalSection>

      <LegalSection heading="3. Your Consent">
        <LegalParagraph>
          On your first visit we show a cookie banner that asks you to choose
          between &quot;Accept all&quot; and &quot;Essential only&quot;. Your
          choice is recorded in your browser&apos;s local storage and in a
          first-party cookie called &quot;screenshotapi_consent&quot; that
          expires 12 months after it is set. We also record aggregate,
          non-identifying events about the banner itself (that it was shown,
          and whether you chose accept or essential-only) so we can understand
          how visitors respond to it. Non-essential cookies, such as analytics,
          are only used if you accept them. You can change your choice at any
          time using the &quot;Cookie Settings&quot; button in the footer of
          the website.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="4. Managing Cookies">
        <LegalParagraph>
          Most browsers let you view, block, or delete cookies through their
          settings. You can also clear local storage from your browser. Please
          note that blocking or deleting essential cookies may prevent you
          from signing in to the dashboard and using the Service.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="5. Third-Party Services">
        <LegalParagraph>
          When you pay for a subscription, you are redirected to Dodo
          Payments&apos; hosted checkout, which operates under its own cookie and
          privacy policies. We do not control cookies set by third-party
          services.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. International Users">
        <LegalParagraph>
          We provide the Service to users around the world and aim to comply
          with the privacy and electronic communications laws that apply to
          you, including the EU General Data Protection Regulation (GDPR) and
          the ePrivacy Directive for users in the European Economic Area, the
          UK GDPR for users in the United Kingdom, the California Consumer
          Privacy Act (CCPA/CPRA) for users in California, and other local
          laws. In practice this means essential cookies are used only where
          strictly necessary, and any non-essential cookies are used only with
          your consent or where otherwise permitted by law.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="7. Changes to This Policy">
        <LegalParagraph>
          We may update this Cookie Policy from time to time. Any changes will
          be posted on this page with an updated &quot;Last updated&quot; date.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="8. Contact Us">
        <LegalParagraph>
          If you have questions about this Cookie Policy, email us at{" "}
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
