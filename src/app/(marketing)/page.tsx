import { Hero } from "@/components/home/Hero";
import { TrustedBy } from "@/components/home/TrustedBy";
import { Playground } from "@/components/playground";
import { Features } from "@/components/features";
import { PricingSection } from "@/components/pricing-section";
import { FormatsSection } from "@/components/home/FormatsSection";
import { CodeExamples } from "@/components/home/CodeExamples";
import { CTASection } from "@/components/home/CTASection";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Hero />
      <TrustedBy />
      <Playground />
      <FormatsSection />
      <Features />
      <CodeExamples />
      <PricingSection />
      <CTASection />
    </div>
  );
}