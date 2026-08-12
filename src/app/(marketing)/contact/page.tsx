import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact Us - ScreenshotAPI",
  description:
    "Get in touch with the ScreenshotAPI team. Sales, billing, support, and feedback all start here.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Us - ScreenshotAPI",
    description:
      "Get in touch with the ScreenshotAPI team. Sales, billing, support, and feedback all start here.",
    url: "/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Contact Us</h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600 dark:text-zinc-400">
          Questions about pricing, billing, an integration, or the API itself?
          Send us a message and we&apos;ll get back to you.
        </p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-zinc-50/50 dark:bg-zinc-950/50 p-6 sm:p-8">
        <ContactForm />
      </div>

      <div className="mt-10 space-y-2 text-center text-sm text-zinc-500">
        <p>
          Prefer email? Reach us directly at{" "}
          <a
            href="mailto:hello@screenshotapi.tech"
            className="text-[var(--primary)] underline underline-offset-4"
          >
            hello@screenshotapi.tech
          </a>
        </p>
        <p>We typically respond within one business day.</p>
      </div>
    </div>
  );
}
