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
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-zinc-500">Usage insights and performance metrics</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Usage Trends</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <UsageChart data={dailyUsage} />
          <LatencyChart data={latencyStats} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Patterns</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PeakHoursHeatmap data={peakHours} />
          <UsageForecast data={usageForecast} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Infrastructure</h2>
        <BandwidthChart data={bandwidthStats} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Cost Analysis</h2>
        <CostEstimation data={costEstimation} />
      </section>
    </div>
  );
}
