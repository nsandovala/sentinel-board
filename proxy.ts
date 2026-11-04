import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { authorizeApi, authorizedParties, sessionPrincipal } from "@/lib/server/api-auth";
import { permissionFor } from "@/lib/server/api-policy.mjs";

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const api = req.nextUrl.pathname.startsWith("/api/");
  if (api && !permissionFor(req.nextUrl.pathname, req.method)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  // Service import is independent of Clerk availability. Credentials on any
  // other API are denied by the same explicit policy, never by network identity.
  if (api && (req.headers.has("authorization") || req.headers.has("x-sentinel-token"))) {
    return (await authorizeApi(req, async () => null)) ?? NextResponse.next();
  }
  const parties = authorizedParties();
  if (!parties || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
    return new NextResponse("Authentication configuration unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return clerkMiddleware(async (clerkAuth, request) => {
    if (!request.nextUrl.pathname.startsWith("/api/")) return;
    return (await authorizeApi(request, async () =>
      sessionPrincipal(await clerkAuth({ acceptsToken: "session_token" })),
    )) ?? undefined;
  }, { authorizedParties: parties })(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
