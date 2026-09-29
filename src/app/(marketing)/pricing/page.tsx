import type { Metadata } from "next";
import { PricingSection } from "@/components/pricing-section";

export const metadata: Metadata = {
  title: "Pricing - ScreenshotAPI",
  description: "Straightforward pricing for website capture infrastructure. Start with 100 free credits; full-page captures and PDF are included on every plan.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingSection />
    </div>
  );
}
