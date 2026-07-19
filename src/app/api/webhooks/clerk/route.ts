import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createServiceClient } from "@/lib/supabase/server";

const supabase = createServiceClient();

export async function POST(request: NextRequest) {
  try {
    const evt = await verifyWebhook(request);

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const user = evt.data;

      const primaryEmail =
        user.email_addresses?.find(
          (e) => e.id === user.primary_email_address_id
        )?.email_address ?? null;

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
        console.error("Failed to upsert user:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 }
    );
  }
}
