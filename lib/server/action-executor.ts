/**
 * action-executor.ts
 *
 * Purpose: Execute resolved terminal actions against the real DB.
 * Uses the SAME Postgres database the board reads from — no separate store.
 *
 * Input:  ResolvedAction from action-resolver.ts
 * Output: ActionResult with structured data for the terminal
 *
 * Dependency: lib/db (Drizzle + pg), lib/db/schema
 *
 * Risks:
 * - Writes here bypass the React reducer. The client needs to re-hydrate
 *   or the board will be stale until next page load. For MOVE_CARD, the
 *   terminal-runner should hint the client to refresh.
 * - Fuzzy title matching uses includes() — could match wrong card if
 *   titles are substrings of each other. Good enough for phase 1.
 */

import { db } from "@/lib/db";
import { tasks, taskChecklistItems, events } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { STATUS_LABELS } from "@/lib/console/status-labels";
import { logDockEvent } from "./log-event";
import { analyzeRootCause } from "./root-cause-analyzer";
import type { ResolvedAction } from "./action-resolver";
import type { CardStatus, PriorityLevel } from "@/types/enums";

export interface ActionMeta {
  affectedCardId?: string;
  previousStatus?: string;
  newStatus?: string;
  [key: string]: unknown;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  data?: unknown;
  meta?: ActionMeta;
  hint?: "refresh_board";
}

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

async function findCardByTitle(title: string) {
  const all = await db.select().from(tasks);
  const lower = title.toLowerCase();

  const exact = all.find((t) => t.title.toLowerCase() === lower);
  if (exact) return exact;

  return all.find((t) => t.title.toLowerCase().includes(lower));
}

function executeGetTime(): ActionResult {
  const now = new Date();
  const time = now.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const date = now.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return { ok: true, message: `${date} · ${time}` };
}

async function executeGetTopPriority(count: number): Promise<ActionResult> {
  const all = await db.select().from(tasks);

  const active = all.filter(
    (t) => t.status !== "archivado" && t.status !== "listo" && t.status !== "produccion",
  );

  const sorted = active.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority as PriorityLevel] ?? 9;
    const pb = PRIORITY_ORDER[b.priority as PriorityLevel] ?? 9;
    return pa - pb;
  });

  const top = sorted.slice(0, count);

  if (top.length === 0) {
    return { ok: true, message: "No hay tareas activas.", data: [] };
  }

  const lines = top.map((t, i) => {
    const label = STATUS_LABELS[t.status as CardStatus] ?? t.status;
    return `${i + 1}. [${t.priority.toUpperCase()}] ${t.title} (${label})`;
  });

  return {
    ok: true,
    message: lines.join("\n"),
    data: top.map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
    })),
  };
}

async function executeMoveCard(title: string, status: string): Promise<ActionResult> {
  const card = await findCardByTitle(title);
  if (!card) {
    return { ok: false, message: `Card no encontrada: "${title}"` };
  }

  const validStatuses = Object.keys(STATUS_LABELS);
  if (!validStatuses.includes(status)) {
    return { ok: false, message: `Estado inválido: "${status}"` };
  }

  if (card.status === status) {
    const label = STATUS_LABELS[status as CardStatus] ?? status;
    return { ok: true, message: `"${card.title}" ya está en ${label}` };
  }

  const previousStatus = card.status;
  const oldLabel = STATUS_LABELS[previousStatus as CardStatus] ?? previousStatus;
  const newLabel = STATUS_LABELS[status as CardStatus] ?? status;

  await db.update(tasks)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, card.id));

  await logDockEvent("command", `"${card.title}" → ${newLabel}`);

  return {
    ok: true,
    message: `"${card.title}": ${oldLabel} → ${newLabel}`,
    meta: {
      affectedCardId: card.id,
      previousStatus,
      newStatus: status,
    },
    hint: "refresh_board",
  };
}

async function executeListTasks(projectQuery: string): Promise<ActionResult> {
  const all = await db.select().from(tasks);

  let filtered = all;
  if (projectQuery) {
    const q = projectQuery.toLowerCase();
    filtered = all.filter((t) =>
      t.projectId.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q),
    );
  }

  const active = filtered.filter(
    (t) => t.status !== "archivado" && t.status !== "produccion",
  );

  if (active.length === 0) {
    return { ok: true, message: "No hay tareas activas.", data: [] };
  }

  const lines = active.map((t, i) => {
    const label = STATUS_LABELS[t.status as CardStatus] ?? t.status;
    return `${i + 1}. ${t.title} (${label}) [${t.priority}]`;
  });

  return {
    ok: true,
    message: `${active.length} tarea(s):\n${lines.join("\n")}`,
    data: active.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
    })),
  };
}

async function executeDeleteCard(title: string): Promise<ActionResult> {
  const card = await findCardByTitle(title);
  if (!card) {
    return { ok: false, message: `Card no encontrada: "${title}"` };
  }

  await db.delete(tasks).where(eq(tasks.id, card.id));
  await logDockEvent("command", `Tarea eliminada: "${card.title}"`);

  return {
    ok: true,
    message: `Eliminada: "${card.title}"`,
    meta: { affectedCardId: card.id, previousStatus: card.status },
    hint: "refresh_board",
  };
}

async function executeAnalyzeRootCause(titleQuery: string): Promise<ActionResult> {
  if (!titleQuery) {
    return { ok: false, message: "Especificá la tarea: diagnosticar [nombre de tarea]" };
  }

  const card = await findCardByTitle(titleQuery);
  if (!card) {
    return { ok: false, message: `Card no encontrada: "${titleQuery}"` };
  }

  const recentEventRows = await db
    .select()
    .from(events)
    .orderBy(desc(events.createdAt))
    .limit(10);
  const recentEvts = recentEventRows
    .filter((e) => e.message.includes(card.title))
    .map((e) => e.message);

  const checklist = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, card.id));

  const analysis = analyzeRootCause({
    symptom: `Diagnóstico de "${card.title}"`,
    taskId: card.id,
    projectId: card.projectId,
    currentStatus: card.status,
    recentEvents: recentEvts.length > 0 ? recentEvts : undefined,
    metadata: {
      title: card.title,
      blocked: card.blocked,
      blockerReason: card.blockerReason ?? undefined,
      priority: card.priority,
      type: card.type,
      tags: (card.tags ?? []) as string[],
      checklistTotal: checklist.length,
      checklistDone: checklist.filter((c) => c.status === "done").length,
      createdAt: card.createdAt,
      description: card.description ?? undefined,
    },
  });

  const sevLabel = analysis.severidad.toUpperCase();
  await logDockEvent("system", `Root cause [${sevLabel}]: ${analysis.causa_raiz.slice(0, 120)}`);

  const lines = [
    `"${card.title}" — Root Cause [${sevLabel}]`,
    `Confianza: ${analysis.confidence}%`,
    ``,
    `Problema: ${analysis.problema_observable}`,
    `Causa inmediata: ${analysis.causa_inmediata}`,
    ``,
    `1. ${analysis.por_que_1}`,
    `2. ${analysis.por_que_2}`,
    `3. ${analysis.por_que_3}`,
    `4. ${analysis.por_que_4}`,
    `5. ${analysis.por_que_5}`,
    ``,
    `Causa raíz: ${analysis.causa_raiz}`,
    `Correctiva: ${analysis.accion_correctiva}`,
    `Preventiva: ${analysis.accion_preventiva}`,
  ];

  if (analysis.requiere_agente) {
    lines.push(``, `⚠ Requiere agente: ${analysis.agente_sugerido ?? "por definir"}`);
  }

  return {
    ok: true,
    message: lines.join("\n"),
    data: analysis,
    meta: { affectedCardId: card.id, analysisType: "root_cause" },
    hint: "refresh_board",
  };
}

export async function executeAction(action: ResolvedAction): Promise<ActionResult> {
  switch (action.type) {
    case "GET_TIME":
      return executeGetTime();

    case "GET_TOP_PRIORITY":
      return await executeGetTopPriority(parseInt(action.args.count ?? "3", 10));

    case "MOVE_CARD":
      return await executeMoveCard(action.args.title, action.args.status);

    case "LIST_TASKS":
      return await executeListTasks(action.args.project ?? "");

    case "DELETE_CARD":
      return await executeDeleteCard(action.args.title);

    case "ANALYZE_ROOT_CAUSE":
      return await executeAnalyzeRootCause(action.args.title);

    default:
      return { ok: false, message: `Acción desconocida: ${action.type}` };
  }
}
