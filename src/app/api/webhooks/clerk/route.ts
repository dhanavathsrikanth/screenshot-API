import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const supabase = createServiceClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    };

    const signingSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
    if (signingSecret) {
      const { verifyWebhook } = await import("@clerk/nextjs/webhooks");
      const evt = await verifyWebhook(request);
      await handleEvent(evt.type, evt.data);
    } else {
      const payload = JSON.parse(body);
      await handleEvent(payload.type, payload.data);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[Clerk Webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
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
    }
  }
}
