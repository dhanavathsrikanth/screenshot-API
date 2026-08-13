import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getDailyUsage,
  getLatencyStats,
  getPeakHours,
  getUsageForecast,
  getBandwidthStats,
  getCostEstimation,
} from "@/app/actions/analytics";
import {
  UsageChart,
  LatencyChart,
  PeakHoursHeatmap,
  UsageForecast,
  BandwidthChart,
  CostEstimation,
} from "@/components/dashboard/charts";
import { PageHeader } from "@/components/dashboard/page-header";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="eyebrow text-zinc-400 mb-4">{children}</h2>;
}

export default async function AnalyticsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  let dailyUsage: any[];
  let latencyStats: any[];
  let peakHours: any[];
  let usageForecast: any;
  let bandwidthStats: any[];
  let costEstimation: any;

  try {
    [dailyUsage, latencyStats, peakHours, usageForecast, bandwidthStats, costEstimation] =
      await Promise.all([
        getDailyUsage(userId),
        getLatencyStats(userId),
        getPeakHours(userId),
        getUsageForecast(userId),
        getBandwidthStats(userId),
        getCostEstimation(userId),
      ]);
  } catch {
    dailyUsage = [];
    latencyStats = [];
    peakHours = [];
    usageForecast = { forecast: [], dailyAvg: 0, monthlyUsed: 0, monthlyLimit: 100, daysUntilLimit: null };
    bandwidthStats = [];
    costEstimation = { plan: "free", monthlyPrice: 0, monthlyUsed: 0, monthlyLimit: 100, computeCost: 0, storageCost: 0, totalEstimatedCost: 0, storageGB: 0, costPerScreenshot: 0, recommendedPlan: null };
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Analytics"
        title="Usage & Performance"
        description="Usage insights and performance metrics across your account"
      />

      <section>
        <SectionTitle>Usage Trends</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UsageChart data={dailyUsage} />
          <LatencyChart data={latencyStats} />
        </div>
      </section>

      <section>
        <SectionTitle>Patterns</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PeakHoursHeatmap data={peakHours} />
          <UsageForecast data={usageForecast} />
        </div>
      </section>

      <section>
        <SectionTitle>Infrastructure</SectionTitle>
        <BandwidthChart data={bandwidthStats} />
      </section>

      <section>
        <SectionTitle>Cost Analysis</SectionTitle>
        <CostEstimation data={costEstimation} />
      </section>
    </div>
  );
}
