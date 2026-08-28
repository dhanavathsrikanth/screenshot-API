import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PostHogFunnelEvents } from "@/components/providers/posthog-funnel-events";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PostHogFunnelEvents />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
