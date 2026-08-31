"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/posthog";

/** Returns true when the project belongs to the user. */
export async function verifyProjectOwnership(
  userId: string,
  projectId: string
): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/**
 * Ensure the user has a project to attach API keys to. Service role so new
 * users who never opened the dashboard still get a project on first key.
 */
export async function getOrCreateProject(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data?.id) return data.id;

  const { data: created, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name: "Default Project" })
    .select("id")
    .single();

  if (error) return null;
  return created.id;
}

export type ProjectRow = {
  id: string;
  name: string;
  slug: string | null;
  plan: string;
  monthly_limit: number;
  created_at: string;
  api_key_count?: number;
  screenshot_count?: number;
  webhook_count?: number;
  usage_30d?: number;
  usage_trend?: { date: string; count: number }[];
};

export async function listProjects(): Promise<ProjectRow[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, slug, plan, monthly_limit, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const projects = (data ?? []) as ProjectRow[];
  if (projects.length === 0) return projects;

  // Attach per-project key + screenshot counts in one query each.
  const ids = projects.map((p) => p.id);
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [keys, shots, hooks, usage] = await Promise.all([
    supabase
      .from("api_keys")
      .select("project_id")
      .in("project_id", ids),
    supabase
      .from("screenshots")
      .select("project_id")
      .in("project_id", ids),
    supabase
      .from("webhook_endpoints")
      .select("project_id")
      .in("project_id", ids),
    supabase
      .from("usage_events")
      .select("project_id")
      .in("project_id", ids)
      .gte("created_at", since30d),
  ]);

  const keyCounts = new Map<string, number>();
  for (const row of keys.data ?? []) {
    keyCounts.set(row.project_id as string, (keyCounts.get(row.project_id as string) ?? 0) + 1);
  }
  const shotCounts = new Map<string, number>();
  for (const row of shots.data ?? []) {
    shotCounts.set(row.project_id as string, (shotCounts.get(row.project_id as string) ?? 0) + 1);
  }
  const hookCounts = new Map<string, number>();
  for (const row of hooks.data ?? []) {
    hookCounts.set(row.project_id as string, (hookCounts.get(row.project_id as string) ?? 0) + 1);
  }
  const usageCounts = new Map<string, number>();
  for (const row of usage.data ?? []) {
    usageCounts.set(row.project_id as string, (usageCounts.get(row.project_id as string) ?? 0) + 1);
  }

  const trendSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: trendRows } = await supabase
    .from("usage_events")
    .select("project_id, created_at")
    .in("project_id", ids)
    .gte("created_at", trendSince);

  const trendByProject = new Map<string, Map<string, number>>();
  for (const row of trendRows ?? []) {
    const pid = row.project_id as string;
    const day = (row.created_at as string).slice(0, 10);
    if (!trendByProject.has(pid)) trendByProject.set(pid, new Map());
    const dayMap = trendByProject.get(pid)!;
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  return projects.map((p) => {
    const dayMap = trendByProject.get(p.id) ?? new Map();
    return {
      ...p,
      api_key_count: keyCounts.get(p.id) ?? 0,
      screenshot_count: shotCounts.get(p.id) ?? 0,
      webhook_count: hookCounts.get(p.id) ?? 0,
      usage_30d: usageCounts.get(p.id) ?? 0,
      usage_trend: last7Days.map((date) => ({ date, count: dayMap.get(date) ?? 0 })),
    };
  });
}

/** Fetch a single project with counts; returns null when not owned or missing. */
export async function getProject(userId: string, projectId: string): Promise<ProjectRow | null> {
  const owned = await verifyProjectOwnership(userId, projectId);
  if (!owned) return null;

  const projects = await listProjects();
  return projects.find((p) => p.id === projectId) ?? null;
}

export async function createProject(name: string): Promise<ProjectRow> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name is required.");
  if (trimmed.length > 64) throw new Error("Project name must be 64 characters or fewer.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name: trimmed })
    .select("id, name, slug, plan, monthly_limit, created_at")
    .single();

  if (error) throw error;

  // Activation funnel: project_created (blueprint §16).
  await trackServerEvent({
    userId,
    event: "project_created",
    properties: { project_id: data.id, source: "dashboard" },
  }).catch(() => {});

  return data as ProjectRow;
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name is required.");
  if (trimmed.length > 64) throw new Error("Project name must be 64 characters or fewer.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) throw error;

  await trackServerEvent({
    userId,
    event: "project_renamed",
    properties: { project_id: projectId },
  }).catch(() => {});
}

export async function deleteProject(projectId: string): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");

  const { count: projectCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((projectCount ?? 0) <= 1) {
    throw new Error("You must keep at least one project.");
  }

  const { count: keyCount } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((keyCount ?? 0) > 0) {
    throw new Error("Remove or reassign API keys before deleting this project.");
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);
  if (error) throw error;

  await trackServerEvent({
    userId,
    event: "project_deleted",
    properties: { project_id: projectId },
  }).catch(() => {});
}
