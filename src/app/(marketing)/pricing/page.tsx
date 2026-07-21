import type { Metadata } from "next";
import { PricingSection } from "@/components/pricing-section";

export const metadata: Metadata = {
  title: "Pricing - ScreenTool",
  description: "Simple, transparent pricing for the ScreenTool screenshot API.",
};

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingSection />
    </div>
  );
}
