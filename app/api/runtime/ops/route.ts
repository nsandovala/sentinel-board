import { authorizeApi } from "@/lib/server/api-auth";
import { NextRequest, NextResponse } from "next/server";
import { normalizeOpsSnapshot, offlineSnapshot, opsUrl } from "@/lib/server/ops-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await authorizeApi(req);
  if (denied) return denied;
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  // This bridge is a local developer surface. Never proxy AA from a deployed SB.
  const host = req.headers.get("host")?.toLowerCase() ?? "";
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(req.nextUrl.hostname) || !/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host)) {
    return NextResponse.json(offlineSnapshot(), { status: 403, headers });
  }
  const url = opsUrl(process.env.AMON_OPS_SNAPSHOT_URL);
  if (!url) return NextResponse.json(offlineSnapshot(), { headers });
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(1500), redirect: "error" });
    if (!response.ok || Number(response.headers.get("content-length") ?? "0") > 1_000_000) throw new Error("snapshot_unavailable");
    const body = await response.text();
    if (body.length > 1_000_000) throw new Error("snapshot_too_large");
    return NextResponse.json(normalizeOpsSnapshot(JSON.parse(body)), { headers });
  } catch {
    return NextResponse.json(offlineSnapshot(), { headers });
  }
}
