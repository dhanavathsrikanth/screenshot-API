import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";
import { Hero } from "@/components/home/Hero";
import { StackStrip } from "@/components/home/StackStrip";
import { HowItWorks } from "@/components/home/HowItWorks";
import { FormatsSection } from "@/components/home/FormatsSection";
import { Features } from "@/components/features";
import { Testimonials } from "@/components/home/Testimonials";
import { CodeExamples } from "@/components/home/CodeExamples";
import { PricingSection } from "@/components/pricing-section";
import { CTASection } from "@/components/home/CTASection";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    title: "ScreenshotAPI - The Screenshot API for Developers",
    description:
      "Render website screenshots in one simple API call. Block cookie banners, ads, and chat widgets. Full-page, high-resolution, dark mode, and more.",
    url: "/",
    type: "website",
  },
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  email: siteConfig.email,
  publisher: { "@id": `${siteConfig.url}/#organization` },
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
    },
    {
      "@type": "Offer",
      name: "Starter",
      price: "9",
      priceCurrency: "USD",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "49",
      priceCurrency: "USD",
    },
  ],
};

export default function Home() {
  return (
    <div className="scroll-smooth">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
      />
      <Hero />
      <StackStrip />
      <HowItWorks />
      <FormatsSection />
      <Features />
      <Testimonials />
      <CodeExamples />
      <PricingSection />
      <CTASection />
    </div>
  );
}
