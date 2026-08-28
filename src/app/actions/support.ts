"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";

async function assertAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId || !(await isAdminUser(userId))) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export type RequestTraceRow = {
  request_id: string;
  user_id: string;
  project_id: string | null;
  api_key_id: string | null;
  endpoint: string;
  method: string;
  status_code: number | null;
  latency_ms: number | null;
  ip_hash: string | null;
  user_agent: string | null;
  cached: boolean;
  created_at: string;
};

export type JobTraceRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  api_key_id: string | null;
  status: string;
  screenshot_id: string | null;
  storage_url: string | null;
  format: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  cached: boolean;
  error_code: string | null;
  error_message: string | null;
  credits_charged: number;
  options: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type UsageEventRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  event_type: string;
  units: number;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type RequestTrace = {
  requestId: string;
  request: RequestTraceRow | null;
  job: JobTraceRow | null;
  usageEvents: UsageEventRow[];
  user: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    plan: string | null;
  } | null;
  project: { id: string; name: string } | null;
  apiKey: { id: string; name: string; key_prefix: string; environment: string; is_active: boolean } | null;
};

type UserProfileRow = { id: string; email: string | null; first_name: string | null; last_name: string | null };

export async function lookupRequestTrace(requestId: string): Promise<RequestTrace> {
  await assertAdmin();

  const id = requestId.trim();
  if (!id || id.length > 200) {
    throw new Error("Invalid request id.");
  }

  const supabase = createServiceClient();

  const [requestsRes, jobsRes, usageRes] = await Promise.all([
    supabase
      .from("api_requests")
      .select("request_id, user_id, project_id, api_key_id, endpoint, method, status_code, latency_ms, ip_hash, user_agent, cached, created_at")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("screenshot_jobs")
      .select("id, user_id, project_id, api_key_id, status, screenshot_id, storage_url, format, width, height, size_bytes, cached, error_code, error_message, credits_charged, options, created_at, started_at, completed_at")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("usage_events")
      .select("id, user_id, project_id, event_type, units, duration_ms, metadata, created_at")
      .filter("metadata->>request_id", "eq", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const request = (requestsRes.data?.[0] as RequestTraceRow) ?? null;
  const job = (jobsRes.data?.[0] as JobTraceRow) ?? null;
  const usageEvents = (usageRes.data ?? []) as UsageEventRow[];

  // Correlate the actor: user, project, and API key identity.
  const userIds = [...new Set([request?.user_id, job?.user_id, ...usageEvents.map((u) => u.user_id)])].filter(
    (id): id is string => Boolean(id)
  );
  // screenshot_jobs stores project_id and api_key_id as TEXT while the
  // referenced tables use UUID, so only match well-formed ids.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const projectIds = [...new Set([request?.project_id, job?.project_id, ...usageEvents.map((u) => u.project_id)])]
    .filter((id): id is string => Boolean(id))
    .filter((id) => uuidPattern.test(id));
  const keyIds = [...new Set([request?.api_key_id, job?.api_key_id])]
    .filter((id): id is string => Boolean(id))
    .filter((id) => uuidPattern.test(id));

  const [usersRes, projectsRes, keysRes, quotasRes] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("id, email, first_name, last_name").in("id", userIds)
      : Promise.resolve({ data: [] as UserProfileRow[], error: null }),
    projectIds.length > 0
      ? supabase.from("projects").select("id, name").in("id", projectIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    keyIds.length > 0
      ? supabase.from("api_keys").select("id, name, key_prefix, environment, is_active").in("id", keyIds)
      : Promise.resolve({ data: [] as RequestTrace["apiKey"][], error: null }),
    userIds.length > 0
      ? supabase.from("user_quotas").select("user_id, plan").in("user_id", userIds)
      : Promise.resolve({ data: [] as { user_id: string; plan: string }[], error: null }),
  ]);

  const userRows = (usersRes.data ?? []) as UserProfileRow[];
  const projectRows = (projectsRes.data ?? []) as { id: string; name: string }[];
  const keyRows = (keysRes.data ?? []) as RequestTrace["apiKey"][];
  const quotaRows = (quotasRes.data ?? []) as { user_id: string; plan: string }[];

  const primaryUserId = userIds[0] ?? null;
  const profile = userRows.find((u) => u.id === primaryUserId) ?? null;
  const quota = quotaRows.find((q) => q.user_id === primaryUserId) ?? null;

  return {
    requestId: id,
    request,
    job,
    usageEvents,
    user: primaryUserId
      ? {
          id: primaryUserId,
          email: profile?.email ?? null,
          first_name: profile?.first_name ?? null,
          last_name: profile?.last_name ?? null,
          plan: quota?.plan ?? null,
        }
      : null,
    project: projectRows[0] ?? null,
    apiKey: keyRows[0] ?? null,
  };
}

export type RecentRequestRow = {
  request_id: string | null;
  user_id: string;
  email: string | null;
  endpoint: string;
  method: string;
  status_code: number | null;
  latency_ms: number | null;
  cached: boolean;
  created_at: string;
};

export async function recentRequests(limit = 25): Promise<RecentRequestRow[]> {
  await assertAdmin();

  const supabase = createServiceClient();
  const capped = Math.min(Math.max(limit, 5), 100);

  const { data, error } = await supabase
    .from("api_requests")
    .select("request_id, user_id, endpoint, method, status_code, latency_ms, cached, created_at")
    .order("created_at", { ascending: false })
    .limit(capped);

  if (error) return [];

  const rows = (data ?? []) as Omit<RecentRequestRow, "email">[];

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (userIds.length === 0) return [];

  const { data: users } = await supabase
    .from("users")
    .select("id, email")
    .in("id", userIds);

  const emailById = new Map((users ?? []).map((u) => [u.id as string, (u as { email: string | null }).email]));

  return rows.map((r) => ({
    ...r,
    email: r.user_id ? emailById.get(r.user_id) ?? null : null,
  }));
}
