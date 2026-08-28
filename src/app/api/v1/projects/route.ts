import { NextRequest } from "next/server";
import { resolveAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { v1Ok, v1Err } from "@/lib/v1-api";
import { getRequestId } from "@/lib/api";
import { newRequestId } from "@/lib/request-id";
import { trackServerEvent } from "@/lib/posthog";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }

    const supabase = createServiceClient();
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, name, slug, plan, monthly_limit, created_at")
      .eq("user_id", authCtx.userId)
      .order("created_at", { ascending: false });

    if (error) {
      return v1Err(500, "internal_error", error.message, requestId);
    }

    const rows = projects ?? [];
    if (rows.length === 0) {
      return v1Ok({ projects: [], pagination: null });
    }

    const ids = rows.map((p) => p.id);
    const [keys, shots] = await Promise.all([
      supabase.from("api_keys").select("project_id").in("project_id", ids),
      supabase.from("screenshots").select("project_id").in("project_id", ids),
    ]);

    const keyCounts = new Map<string, number>();
    for (const row of keys.data ?? []) {
      keyCounts.set(row.project_id as string, (keyCounts.get(row.project_id as string) ?? 0) + 1);
    }
    const shotCounts = new Map<string, number>();
    for (const row of shots.data ?? []) {
      shotCounts.set(row.project_id as string, (shotCounts.get(row.project_id as string) ?? 0) + 1);
    }

    return v1Ok({
      projects: rows.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        plan: p.plan,
        monthly_limit: p.monthly_limit,
        api_key_count: keyCounts.get(p.id) ?? 0,
        screenshot_count: shotCounts.get(p.id) ?? 0,
        created_at: p.created_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request) ?? newRequestId();
  try {
    const authCtx = await resolveAuth(request);
    if (!authCtx) {
      return v1Err(
        401,
        "unauthorized",
        "Authentication required. Include a valid API key via the Authorization: Bearer or x-api-key header.",
        requestId
      );
    }

    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return v1Err(400, "invalid_parameters", "Project `name` is required.", requestId);
    }
    if (name.length > 64) {
      return v1Err(400, "invalid_parameters", "Project name must be 64 characters or fewer.", requestId);
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({ user_id: authCtx.userId, name })
      .select("id, name, slug, plan, monthly_limit, created_at")
      .single();

    if (error) {
      return v1Err(500, "internal_error", error.message, requestId);
    }

    // Activation funnel: project_created (blueprint §16).
    await trackServerEvent({
      userId: authCtx.userId,
      event: "project_created",
      properties: { project_id: data.id, source: "api" },
    }).catch(() => {});

    return v1Ok(
      {
        id: data.id,
        name: data.name,
        slug: data.slug,
        plan: data.plan,
        monthly_limit: data.monthly_limit,
        api_key_count: 0,
        screenshot_count: 0,
        created_at: data.created_at,
      },
      { status: 201, requestId }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return v1Err(500, "internal_error", message, requestId);
  }
}
