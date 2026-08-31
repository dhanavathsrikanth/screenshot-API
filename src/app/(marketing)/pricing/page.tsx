import type { Metadata } from "next";
import { PricingSection } from "@/components/pricing-section";

export const metadata: Metadata = {
  title: "Pricing - ScreenshotAPI",
  description: "Simple pricing for screenshot APIs. 100 free viewport captures, then $9/mo for full-page, PDF, and production volume.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingSection />
    </div>
  );
}
