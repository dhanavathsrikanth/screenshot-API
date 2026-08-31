"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";

export type NotificationInsert = {
  type?: string;
  severity?: string;
  title: string;
  message?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
};

/**
 * Insert an internal operational alert (e.g. storage fallback). Safe to call
 * from any server path — it never throws, so render flows are never blocked.
 */
export async function notifyStorageFallback(input: {
  type: string;
  severity: string;
  title: string;
  message?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("admin_notifications").insert({
    type: input.type,
    severity: input.severity,
    title: input.title,
    message: input.message ?? "",
    metadata: input.metadata ?? {},
    user_id: input.userId ?? null,
  });
}

export type AdminNotificationRow = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
  read_at: string | null;
  created_at: string;
};

async function assertAdmin(): Promise<void> {
  const { userId } = await auth();
  if (!userId || !(await isAdminUser(userId))) {
    throw new Error("Unauthorized");
  }
}

/** List the most recent admin notifications (admin-only). */
export async function getAdminNotifications(
  limit = 50
): Promise<AdminNotificationRow[]> {
  await assertAdmin();
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(1, limit), 200));

  if (error) throw error;
  return (data ?? []) as AdminNotificationRow[];
}

/** Mark a notification as read (admin-only). */
export async function markAdminNotificationRead(id: string): Promise<void> {
  await assertAdmin();
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/dashboard/admin");
}
