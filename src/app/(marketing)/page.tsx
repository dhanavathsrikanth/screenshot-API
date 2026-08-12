import type { Metadata } from "next";
import { Hero } from "@/components/home/Hero";
import { TrustedBy } from "@/components/home/TrustedBy";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Playground } from "@/components/playground";
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

export default function Home() {
  return (
    <div className="min-h-screen">
      <Hero />
      <TrustedBy />
      <HowItWorks />
      <Playground />
      <FormatsSection />
      <Features />
      <Testimonials />
      <CodeExamples />
      <PricingSection />
      <CTASection />
    </div>
  );
}
