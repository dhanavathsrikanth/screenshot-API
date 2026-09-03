import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDailyUsage, getLatencyStats, getBandwidthStats } from "@/app/actions/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const daysParam = request.nextUrl.searchParams.get("days");
  const days = daysParam === "7" ? 7 : daysParam === "90" ? 90 : 30;

  try {
    const [daily, latency, bandwidth] = await Promise.all([
      getDailyUsage(userId, days),
      getLatencyStats(userId, days),
      getBandwidthStats(userId, days),
    ]);

    const rows = [
      ["date", "requests", "ma7", "avg_latency_ms", "p50_ms", "p95_ms", "p99_ms", "bandwidth_mb"].join(","),
      ...daily.map((d) => {
        const l = latency.find((x) => x.date === d.date);
        const b = bandwidth.find((x) => x.date === d.date);
        return [
          d.date,
          d.count,
          d.ma7,
          l?.avg ?? 0,
          l?.p50 ?? 0,
          l?.p95 ?? 0,
          l?.p99 ?? 0,
          b?.mb ?? 0,
        ].join(",");
      }),
    ];

    const csv = rows.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-${days}d-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
