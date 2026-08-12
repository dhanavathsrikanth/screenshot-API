"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";

async function assertAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId || !(await isAdminUser(userId))) {
    throw new Error("Unauthorized");
  }
  return userId;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

export type ConsentEventRow = {
  id: string;
  event_type: "impression" | "accept" | "reject";
  path: string | null;
  user_id: string | null;
  created_at: string;
};

export async function getConsentSummary() {
  await assertAdmin();
  const supabase = createServiceClient();

  const { data: events } = await supabase
    .from("consent_events")
    .select("event_type, created_at")
    .gte("created_at", daysAgo(30))
    .order("created_at", { ascending: true });

  const rows = events ?? [];

  const totals = { impression: 0, accept: 0, reject: 0 };
  for (const row of rows) {
    if (row.event_type === "impression") totals.impression++;
    else if (row.event_type === "accept") totals.accept++;
    else if (row.event_type === "reject") totals.reject++;
  }

  const acceptanceRate =
    totals.impression > 0 ? Math.round((totals.accept / totals.impression) * 100) : 0;

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 13);

  const trend = new Map<
    string,
    { date: string; impression: number; accept: number; reject: number }
  >();
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    trend.set(key, { date: key, impression: 0, accept: 0, reject: 0 });
  }

  type EventType = "impression" | "accept" | "reject";
  for (const row of rows) {
    const created = new Date(row.created_at);
    if (created < start) continue;
    const bucket = trend.get(created.toISOString().slice(0, 10));
    const eventType = row.event_type as EventType;
    if (!bucket || !(eventType in bucket)) continue;
    bucket[eventType]++;
  }

  return {
    totals,
    acceptanceRate,
    trend: Array.from(trend.values()),
  };
}

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

export async function getContactMessages(): Promise<ContactMessage[]> {
  await assertAdmin();
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function markContactMessageRead(messageId: string) {
  await assertAdmin();
  const supabase = createServiceClient();
  await supabase.from("contact_messages").update({ status: "read" }).eq("id", messageId);
  revalidatePath("/dashboard/admin");
}
