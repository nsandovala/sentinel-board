import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/server/api-auth";
import { readMissionSnapshot } from "@/lib/server/mission-snapshot";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const denied = await authorizeApi(req);
  if (denied) return denied;
  return NextResponse.json(await readMissionSnapshot(), {headers: {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}});
}
