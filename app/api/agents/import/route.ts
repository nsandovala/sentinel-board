import { authorizeApi } from "@/lib/server/api-auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/agents/import
 *
 * Recibe un payload unificado desde AMON Agents.
 * Hoy es un endpoint mínimo de handshake: parsea, valida, loguea,
 * y retorna confirmación. NO inserta en la base de datos todavía
 * porque el mapeo de projectId y metadata requiere diseño previo.
 */
export async function POST(req: NextRequest) {
  const denied = await authorizeApi(req);
  if (denied) return denied;
  try {

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const taskId = String(body.externalTaskId ?? "").trim();
    if (!taskId) {
      return NextResponse.json(
        { ok: false, error: "Missing externalTaskId" },
        { status: 400 }
      );
    }

    // Log resumido del payload recibido
    const title = String(body.title ?? "(sin título)");
    const agent = String(body.agent ?? "(sin agente)");
    const status = String(body.status ?? "(sin status)");
    const type = String(body.type ?? "(sin type)");
    const priority = String(body.priority ?? "(sin priority)");
    const tags = Array.isArray(body.tags) ? body.tags : [];
    const metadata = body.metadata && typeof body.metadata === "object"
      ? Object.keys(body.metadata as Record<string, unknown>)
      : [];

    console.log("[agents/import] Payload recibido:", {
      taskId,
      title,
      agent,
      status,
      type,
      priority,
      tagsCount: tags.length,
      metadataKeys: metadata,
    });

    return NextResponse.json({
      ok: true,
      received: true,
      taskId,
      message:
        "Payload recibido y logueado. La persistencia en DB se habilitará en una fase posterior.",
    });
  } catch (error) {
    console.error("[POST /api/agents/import]", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Internal error",
      },
      { status: 500 }
    );
  }
}
