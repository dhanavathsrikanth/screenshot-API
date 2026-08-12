import type { Metadata } from "next";
import { PricingSection } from "@/components/pricing-section";

export const metadata: Metadata = {
  title: "Pricing - ScreenshotAPI",
  description: "Simple, transparent pricing for the ScreenshotAPI screenshot API.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingSection />
    </div>
  );
}
