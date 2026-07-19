import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { createServiceClient } from "@/lib/supabase/server";

const supabase = createServiceClient();

export async function POST(request: NextRequest) {
  const body = await request.text();

  const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("[Clerk Webhook] CLERK_WEBHOOK_SIGNING_SECRET not set");
    return NextResponse.json({ error: "Signing secret not configured" }, { status: 500 });
  }

  const wh = new Webhook(signingSecret);

  let evt: { type: string; data: Record<string, unknown> };
  try {
    evt = wh.verify(body, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    }) as { type: string; data: Record<string, unknown> };
  } catch (err) {
    console.error("[Clerk Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleEvent(evt.type, evt.data);
  } catch (err) {
    console.error("[Clerk Webhook] Event handling failed:", err);
    return NextResponse.json({ error: "Event processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleEvent(type: string, data: Record<string, unknown>) {
  if (type === "user.created" || type === "user.updated") {
    const user = data as {
      id: string;
      email_addresses?: { id: string; email_address: string }[];
      primary_email_address_id?: string;
      first_name?: string;
      last_name?: string;
      image_url?: string;
    };

    const primaryEmail =
      user.email_addresses?.find((e) => e.id === user.primary_email_address_id)
        ?.email_address ?? null;

    const { error } = await supabase.from("users").upsert(
      {
        id: user.id,
        email: primaryEmail,
        first_name: user.first_name ?? null,
        last_name: user.last_name ?? null,
        image_url: user.image_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("[Clerk Webhook] Failed to upsert user:", error.message);
      throw error;
    }
  }
}
