import { timingSafeEqual } from "node:crypto";

const routes = [
  [/^\/api\/missions$/, { GET: "runtime:read" }],
  [/^\/api\/tasks$/, { GET: "board:read", POST: "board:write" }],
  [/^\/api\/tasks\/[^/]+$/, { PATCH: "board:write", DELETE: "board:write" }],
  [/^\/api\/tasks\/[^/]+\/comments$/, { GET: "board:read", POST: "board:write" }],
  [/^\/api\/projects$/, { GET: "board:read" }],
  [/^\/api\/events$/, { GET: "board:read", POST: "board:write" }],
  [/^\/api\/knowledge$/, { GET: "knowledge:read", POST: "knowledge:write" }],
  [/^\/api\/search$/, { GET: "knowledge:read" }],
  [/^\/api\/feedback$/, { GET: "board:read", POST: "board:write" }],
  [/^\/api\/insights$/, { GET: "board:read", PATCH: "board:write" }],
  [/^\/api\/insights\/run$/, { POST: "board:write" }],
  [/^\/api\/focus-sessions$/, { GET: "board:read", POST: "board:write" }],
  [/^\/api\/dock-commands$/, { GET: "board:read", POST: "board:write" }],
  [/^\/api\/stream$/, { GET: "board:read" }],
  [/^\/api\/runtime\/events$/, { GET: "runtime:read" }],
  [/^\/api\/runtime\/ops$/, { GET: "runtime:read" }],
  [/^\/api\/agents\/run$/, { POST: "ai:run" }],
  [/^\/api\/agents\/import$/, { POST: "integration:import" }],
  [/^\/api\/copilot\/respond$/, { POST: "ai:run" }],
  [/^\/api\/root-cause$/, { POST: "board:write" }],
];

export const humanPermissions = Object.freeze([
  "board:read", "board:write", "knowledge:read", "knowledge:write",
  "runtime:read", "ai:run",
]);
export const amonPermissions = Object.freeze(["integration:import"]);

export function permissionFor(pathname, method) {
  for (const [pattern, methods] of routes) {
    if (pattern.test(pathname)) return Object.hasOwn(methods, method) ? methods[method] : null;
  }
  return null;
}

export function matchesServiceToken(header, expected) {
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const supplied = header.slice(7);
  if (!supplied || supplied !== supplied.trim()) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function accessStatus(principal, permission) {
  if (!permission) return 403;
  if (!principal) return 401;
  return principal.permissions.includes(permission) ? 200 : 403;
}


export async function authorizeRequest({ pathname, method, headers, serviceToken, legacyServiceToken, resolveUserSession }) {
  const permission = permissionFor(pathname, method);
  if (!permission) return 403;
  const authorization = headers.get("authorization");
  const legacyHeader = headers.get("x-sentinel-token");
  if (authorization !== null || legacyHeader !== null) {
    if (authorization !== null && legacyHeader !== null) return 401;
    const valid = authorization !== null
      ? matchesServiceToken(authorization, serviceToken) || matchesServiceToken(authorization, legacyServiceToken)
      : matchesServiceToken("Bearer " + legacyHeader, legacyServiceToken);
    return accessStatus(valid ? { kind: "service", id: "amon-agents", permissions: amonPermissions } : null, permission);
  }
  try {
    return accessStatus(await resolveUserSession(), permission);
  } catch {
    return 401;
  }
}

export function isAuthorizedOwner(userId, sessionId, configuredOwnerId) {
  return Boolean(userId && sessionId && configuredOwnerId?.trim() && userId === configuredOwnerId.trim());
}

export function parseAuthorizedParties(value, production) {
  if (!value?.trim()) return null;
  const result = [];
  for (const item of value.split(",")) {
    try {
      const url = new URL(item.trim());
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
          (url.protocol !== "https:" && !(url.protocol === "http:" && local && !production))) return null;
      result.push(url.origin);
    } catch { return null; }
  }
  return [...new Set(result)];
}

export function principalForClerkSession(userId, sessionId, configuredOwnerId, claims, parties, now = Date.now()) {
  if (!userId || !sessionId || !parties?.length || !claims || typeof claims !== "object") return null;
  if (claims.sub !== userId || claims.sid !== sessionId ||
      typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now ||
      (claims.nbf !== undefined && (typeof claims.nbf !== "number" || !Number.isFinite(claims.nbf) || claims.nbf * 1000 > now)) ||
      typeof claims.azp !== "string" || !parties.includes(claims.azp) ||
      (claims.sts !== undefined && claims.sts !== "active")) return null;
  return {
    kind: "user", id: userId, expiresAt: claims.exp * 1000,
    permissions: isAuthorizedOwner(userId, sessionId, configuredOwnerId) ? humanPermissions : [],
  };
}

export function isAllowedMutationOrigin(headers, configuredOrigin, parties, production) {
  const origin = headers.get("origin");
  // The Node server's URL may describe its internal listener behind a proxy.
  // Trust only the configured public destination, never request/forwarded hosts.
  if (!configuredOrigin || configuredOrigin.includes(",")) return false;
  const destinations = parseAuthorizedParties(configuredOrigin, production);
  if (!destinations || destinations.length !== 1 ||
      origin !== destinations[0] || !parties?.includes(origin)) return false;
  const fetchSite = headers.get("sec-fetch-site");
  return fetchSite === null || fetchSite === "same-origin";
}
