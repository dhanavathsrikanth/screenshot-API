import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Api-Key, Content-Type, X-Request-Id",
  "Access-Control-Max-Age": "86400",
};

function generateRequestId(): string {
  return crypto.randomUUID();
}

// clerkMiddleware attaches the Clerk auth context so `auth()` works in Server
// Components (dashboard, etc.). It never protects routes on its own, so the
// Dodo/Clerk webhooks and the public API are unaffected. The callback adds
// CORS headers and a request id for the screenshot API, and redirects
// signed-out visitors away from the dashboard.
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { userId } = await auth();
  const requestId = request.headers.get("x-request-id") ?? generateRequestId();
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  if (request.method === "OPTIONS" && isApiRoute) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  // Signed-out users hitting the dashboard go to the sign-in page instead of
  // seeing a broken session-gated UI.
  // For RSC/prefetch requests (?_rsc or RSC header) don't redirect — let the
  // Server Component's `auth()` → `redirect()` handle it with the correct
  // RSC payload. Otherwise the browser's `fetch(storage?_rsc=...)` gets an
  // HTML redirect and surfaces as `Failed to load resource 404 ()` in console.
  const isRscRequest =
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1" ||
    request.nextUrl.searchParams.has("_rsc");
  if (!userId && request.nextUrl.pathname.startsWith("/dashboard") && !isRscRequest) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-request-id", requestId);
  // CORS headers (incl. the `*` origin) are only meaningful — and only safe
  // to send — for the public screenshot API. Sending them on every route
  // (dashboard, sign-in, marketing pages) served no purpose and needlessly
  // widened what cross-origin scripts could read from those responses.
  if (isApiRoute) {
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
  }

  return response;
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"],
};
