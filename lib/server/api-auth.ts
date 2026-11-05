import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, isAllowedMutationOrigin, parseAuthorizedParties, principalForClerkSession } from "./api-policy.mjs";
import type { Principal } from "./api-policy.mjs";

export function authorizedParties(): string[] | null {
  return parseAuthorizedParties(process.env.CLERK_AUTHORIZED_PARTIES, process.env.NODE_ENV === "production");
}

export function sessionPrincipal(session: {
  userId?: string | null; sessionId?: string | null; sessionClaims?: unknown; isAuthenticated?: boolean;
}): Principal | null {
  if (!session.isAuthenticated) return null;
  return principalForClerkSession(
    session.userId ?? null, session.sessionId ?? null, process.env.AMON_OWNER_CLERK_USER_ID,
    session.sessionClaims, authorizedParties(),
  );
}

export async function resolveUserSession(): Promise<Principal | null> {
  if (!authorizedParties()) return null;
  try {
    return sessionPrincipal(await auth({ acceptsToken: "session_token" }));
  } catch {
    // Missing middleware context, invalid/expired tokens and SDK failures fail closed.
    return null;
  }
}

export async function authorizeApi(
  req: NextRequest,
  sessionResolver: () => Promise<Principal | null> = resolveUserSession,
): Promise<NextResponse | null> {
  const status = await authorizeRequest({
    pathname: req.nextUrl.pathname, method: req.method, headers: req.headers,
    serviceToken: process.env.AMON_IMPORT_TOKEN?.trim(),
    legacyServiceToken: process.env.SENTINEL_API_TOKEN?.trim(),
    resolveUserSession: sessionResolver,
  });
  const deny = (status: number) => NextResponse.json(
    { ok: false, error: status === 401 ? "Authentication required" : "Forbidden" },
    { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
  if (status !== 200) return deny(status);
  if (req.method !== "GET" && req.nextUrl.pathname !== "/api/agents/import" &&
      !isAllowedMutationOrigin(req.headers, process.env.SENTINEL_PUBLIC_ORIGIN,
        authorizedParties(), process.env.NODE_ENV === "production")) return deny(403);
  return null;
}
