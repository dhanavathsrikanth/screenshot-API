"use server";

import { auth } from "@clerk/nextjs/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { trackServerEvent } from "@/lib/posthog";

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
  const [keys, shots] = await Promise.all([
    supabase
      .from("api_keys")
      .select("project_id")
      .in("project_id", ids),
    supabase
      .from("screenshots")
      .select("project_id")
      .in("project_id", ids),
  ]);

  const keyCounts = new Map<string, number>();
  for (const row of keys.data ?? []) {
    keyCounts.set(row.project_id as string, (keyCounts.get(row.project_id as string) ?? 0) + 1);
  }
  const shotCounts = new Map<string, number>();
  for (const row of shots.data ?? []) {
    shotCounts.set(row.project_id as string, (shotCounts.get(row.project_id as string) ?? 0) + 1);
  }

  return projects.map((p) => ({
    ...p,
    api_key_count: keyCounts.get(p.id) ?? 0,
    screenshot_count: shotCounts.get(p.id) ?? 0,
  }));
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
    .update({ name: trimmed })
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) throw error;

  await trackServerEvent({
    userId,
    event: "project_renamed",
    properties: { project_id: projectId },
  }).catch(() => {});
}
