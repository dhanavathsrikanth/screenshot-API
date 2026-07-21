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

interface ClerkEmailAddress {
  id: string;
  email_address: string;
  verification?: { status: string; strategy: string };
}

interface ClerkExternalAccount {
  id: string;
  provider: string;
  email_address: string;
  first_name?: string;
  last_name?: string;
  image_url?: string;
  avatar_url?: string;
  google_id?: string;
  username?: string;
}

async function handleEvent(type: string, data: Record<string, unknown>) {
  if (type === "user.created" || type === "user.updated") {
    const user = data as {
      id: string;
      email_addresses?: ClerkEmailAddress[];
      primary_email_address_id?: string;
      first_name?: string;
      last_name?: string;
      image_url?: string;
      profile_image_url?: string;
      has_image?: boolean;
      username?: string;
      locale?: string;
      phone_numbers?: unknown[];
      external_accounts?: ClerkExternalAccount[];
      public_metadata?: Record<string, unknown>;
      private_metadata?: Record<string, unknown>;
      unsafe_metadata?: Record<string, unknown>;
      password_enabled?: boolean;
      two_factor_enabled?: boolean;
      backup_code_enabled?: boolean;
      banned?: boolean;
      locked?: boolean;
      last_active_at?: number;
      last_sign_in_at?: number;
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
        username: user.username ?? null,
        profile_image_url: user.profile_image_url ?? null,
        has_image: user.has_image ?? false,
        locale: user.locale ?? null,
        primary_email_address_id: user.primary_email_address_id ?? null,
        phone_numbers: user.phone_numbers ?? [],
        external_accounts: user.external_accounts ?? [],
        public_metadata: user.public_metadata ?? {},
        private_metadata: user.private_metadata ?? {},
        unsafe_metadata: user.unsafe_metadata ?? {},
        password_enabled: user.password_enabled ?? false,
        two_factor_enabled: user.two_factor_enabled ?? false,
        backup_code_enabled: user.backup_code_enabled ?? false,
        banned: user.banned ?? false,
        locked: user.locked ?? false,
        last_active_at: user.last_active_at ? new Date(user.last_active_at).toISOString() : null,
        last_sign_in_at: user.last_sign_in_at ? new Date(user.last_sign_in_at).toISOString() : null,
        raw_json: data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("[Clerk Webhook] Failed to upsert user:", error.message);
      throw error;
    }

    console.log(`[Clerk Webhook] User ${type}: ${user.id}`);
  }
}
