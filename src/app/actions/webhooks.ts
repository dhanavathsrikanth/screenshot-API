"use server";

import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyProjectOwnership } from "@/app/actions/projects";
import {
  createEndpoint,
  deleteEndpoint,
  listDeliveries,
  listEndpoints,
  replayDelivery,
  testEndpointDelivery,
  updateEndpoint,
  WEBHOOK_EVENTS,
} from "@/lib/webhooks";

async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

async function getDefaultProjectId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function listWebhookEndpoints() {
  const userId = await requireUserId();
  const endpoints = await listEndpoints(userId);
  return endpoints.map(({ id, url, events, is_active, project_id, created_at, updated_at }) => ({
    id,
    url,
    events,
    is_active,
    project_id,
    created_at,
    updated_at,
  }));
}

export async function createWebhookEndpoint(input: {
  url: string;
  events: string[];
  projectId?: string | null;
}) {
  const userId = await requireUserId();
  const events = input.events.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  const url = input.url.trim();
  if (!url) throw new Error("URL is required.");
  if (events.length === 0) throw new Error("Subscribe to at least one event.");
  try {
    new URL(url);
  } catch {
    throw new Error("URL must be valid.");
  }

  let projectId: string | null = null;
  if (input.projectId) {
    const owned = await verifyProjectOwnership(userId, input.projectId);
    if (!owned) throw new Error("Project not found.");
    projectId = input.projectId;
  } else {
    projectId = await getDefaultProjectId(userId);
  }

  const { endpoint, secret } = await createEndpoint({ userId, projectId, url, events });
  return {
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    is_active: endpoint.is_active,
    project_id: endpoint.project_id,
    created_at: endpoint.created_at,
    updated_at: endpoint.updated_at,
    secret,
  };
}

export async function updateWebhookEndpoint(
  id: string,
  patch: { url?: string; events?: string[]; is_active?: boolean; rotate_secret?: boolean }
) {
  const userId = await requireUserId();
  const { endpoint, secret } = await updateEndpoint({
    id,
    userId,
    url: patch.url,
    events: patch.events?.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e)),
    isActive: patch.is_active,
    rotateSecret: patch.rotate_secret,
  });
  return {
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    is_active: endpoint.is_active,
    project_id: endpoint.project_id,
    created_at: endpoint.created_at,
    updated_at: endpoint.updated_at,
    ...(secret !== undefined ? { secret } : {}),
  };
}

export async function removeWebhookEndpoint(id: string) {
  const userId = await requireUserId();
  await deleteEndpoint(id, userId);
}

export async function getWebhookDeliveries(endpointId?: string) {
  const userId = await requireUserId();
  const deliveries = await listDeliveries(userId, endpointId, 50);
  return deliveries.map(
    ({
      id,
      endpoint_id,
      event,
      status,
      attempts,
      http_status,
      error,
      next_retry_at,
      created_at,
      sent_at,
      payload,
    }) => ({
      id,
      endpoint_id,
      event,
      status,
      attempts,
      http_status,
      error,
      next_retry_at,
      created_at,
      sent_at,
      payload,
    })
  );
}

export async function sendWebhookTest(id: string) {
  const userId = await requireUserId();
  return testEndpointDelivery(userId, id);
}

export async function replayWebhookDelivery(deliveryId: string) {
  const userId = await requireUserId();
  await replayDelivery(userId, deliveryId);
}
