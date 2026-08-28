import { NextRequest, NextResponse } from "next/server";
import { resolveShareToken } from "@/lib/shares";

export const dynamic = "force-dynamic";

/**
 * Public share-link resolver. Valid tokens 302-redirect straight to the R2
 * object (no bytes through the server); expired/revoked/unknown tokens get a
 * plain 404 that doesn't reveal which case failed.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const target = await resolveShareToken(token);
  if (!target) {
    return NextResponse.json({ error: "Share link not found or expired." }, { status: 404 });
  }
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
