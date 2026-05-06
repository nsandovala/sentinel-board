import { NextRequest, NextResponse } from "next/server";

function normalizeHost(hostHeader: string | null): string {
  if (!hostHeader) return "";
  return hostHeader
    .trim()
    .replace(/^\[|\]$/g, "")
    .split(":")[0]
    .toLowerCase();
}

function normalizeUrlHost(urlValue: string | null): string {
  if (!urlValue) return "";
  try {
    return new URL(urlValue).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
}

function extractClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim().toLowerCase() ?? "";
  }

  return req.headers.get("x-real-ip")?.trim().toLowerCase() ?? "";
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isLoopbackIp(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function isLocalRequest(req: NextRequest): boolean {
  const host = normalizeHost(req.headers.get("host"));
  const ip = extractClientIp(req);
  return isLoopbackHost(host) || isLoopbackIp(ip);
}

function isTrustedSameOriginBrowserRequest(req: NextRequest): boolean {
  const host = normalizeHost(req.headers.get("host"));
  if (!host) return false;

  const originHost = normalizeUrlHost(req.headers.get("origin"));
  const refererHost = normalizeUrlHost(req.headers.get("referer"));
  const fetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase();

  const hasSameOriginSource =
    (originHost && originHost === host) ||
    (refererHost && refererHost === host);

  if (!hasSameOriginSource) return false;

  return !fetchSite || fetchSite === "same-origin";
}

function hasValidToken(req: NextRequest, expectedToken: string): boolean {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() === expectedToken;
  }

  return req.headers.get("x-sentinel-token")?.trim() === expectedToken;
}

export function rejectIfUnauthorized(req: NextRequest): NextResponse | null {
  const configuredToken = process.env.SENTINEL_API_TOKEN?.trim();

  if (isLocalRequest(req) || isTrustedSameOriginBrowserRequest(req)) {
    return null;
  }

  if (configuredToken && hasValidToken(req, configuredToken)) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "Protected endpoint. Use localhost, the same web origin, or provide a valid SENTINEL_API_TOKEN.",
    },
    { status: 403 },
  );
}
