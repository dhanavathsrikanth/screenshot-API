import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const consentEventSchema = z.object({
  eventType: z.enum(["impression", "accept", "reject"]),
  path: z.string().trim().max(500).optional().default("/"),
});

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = consentEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session.userId ?? null;
    } catch {
      userId = null;
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from("consent_events").insert({
      event_type: parsed.data.eventType,
      path: parsed.data.path,
      user_id: userId,
    });

    if (error) {
      console.error("[consent] Failed to record event:", error.message);
      return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
