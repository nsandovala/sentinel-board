/**
 * action-executor.ts
 *
 * Purpose: Execute resolved terminal actions against the real DB.
 * Uses the SAME SQLite database the board reads from — no separate store.
 *
 * Input:  ResolvedAction from action-resolver.ts
 * Output: ActionResult with structured data for the terminal
 *
 * Dependency: lib/db (Drizzle + better-sqlite3), lib/db/schema
 *
 * Risks:
 * - Writes here bypass the React reducer. The client needs to re-hydrate
 *   or the board will be stale until next page load. For MOVE_CARD, the
 *   terminal-runner should hint the client to refresh.
 * - Fuzzy title matching uses includes() — could match wrong card if
 *   titles are substrings of each other. Good enough for phase 1.
 */

import { db } from "@/lib/db";
import { tasks, events } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { STATUS_LABELS } from "@/lib/console/status-labels";
import type { ResolvedAction } from "./action-resolver";
import type { CardStatus, PriorityLevel } from "@/types/enums";

export interface ActionResult {
  ok: boolean;
  message: string;
  data?: unknown;
  hint?: "refresh_board";
}

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function findCardByTitle(title: string) {
  const all = db.select().from(tasks).all();
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

function executeGetTopPriority(count: number): ActionResult {
  const all = db.select().from(tasks).all();

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

function executeMoveCard(title: string, status: string): ActionResult {
  const card = findCardByTitle(title);
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

  const oldLabel = STATUS_LABELS[card.status as CardStatus] ?? card.status;
  const newLabel = STATUS_LABELS[status as CardStatus] ?? status;

  db.update(tasks)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, card.id))
    .run();

  db.insert(events)
    .values({
      id: `ev-${Date.now()}`,
      type: "command",
      message: `"${card.title}" → ${newLabel}`,
    })
    .run();

  return {
    ok: true,
    message: `"${card.title}": ${oldLabel} → ${newLabel}`,
    hint: "refresh_board",
  };
}

export function executeAction(action: ResolvedAction): ActionResult {
  switch (action.type) {
    case "GET_TIME":
      return executeGetTime();

    case "GET_TOP_PRIORITY":
      return executeGetTopPriority(parseInt(action.args.count ?? "3", 10));

    case "MOVE_CARD":
      return executeMoveCard(action.args.title, action.args.status);

    default:
      return { ok: false, message: `Acción desconocida: ${action.type}` };
  }
}
