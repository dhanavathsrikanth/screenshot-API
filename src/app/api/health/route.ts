import { NextRequest } from "next/server";
import { getRedis } from "@/lib/redis";
import { getRequestId, jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

function envPresent(key: string): boolean {
  return Boolean(process.env[key]);
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  const checks = {
    redis: getRedis() !== null,
    supabase:
      envPresent("NEXT_PUBLIC_SUPABASE_URL") && envPresent("SUPABASE_SERVICE_ROLE_KEY"),
    storage: envPresent("R2_BUCKET_NAME") && envPresent("R2_ENDPOINT"),
  };

  const healthy = Object.values(checks).every(Boolean);

  if (!healthy) {
    return jsonError(503, "service_unavailable", "One or more upstream services are unavailable.", requestId, {
      checks,
    });
  }

  return Response.json(
    {
      status: "ok",
      service: "screenshotapi",
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        ...(requestId ? { "x-request-id": requestId } : {}),
      },
    }
  );
}
