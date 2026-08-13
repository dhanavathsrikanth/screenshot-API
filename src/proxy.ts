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
// CORS headers and a request id for the screenshot API.
export default clerkMiddleware((_auth, request: NextRequest) => {
  const requestId = request.headers.get("x-request-id") ?? generateRequestId();

  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("x-request-id", requestId);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
