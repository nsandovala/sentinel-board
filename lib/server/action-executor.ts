/**
 * action-executor.ts
 *
 * Purpose: Execute resolved terminal actions against the real DB.
 */

import { desc, eq } from "drizzle-orm";
import { calculateMoneyCode } from "@/lib/analysis/money-code";
import { deriveCodexLoop } from "@/lib/analysis/codex-loop";
import { suggestNextAction } from "@/lib/analysis/suggest-next-action";
import { STATUS_LABELS } from "@/lib/console/status-labels";
import { db } from "@/lib/db";
import { events, knowledgeEntries, projects, taskChecklistItems, tasks } from "@/lib/db/schema";
import type { SentinelCard } from "@/types/card";
import type { CardStatus, PriorityLevel } from "@/types/enums";
import type { ResolvedAction } from "./action-resolver";
import { logDockEvent } from "./log-event";
import { analyzeRootCause } from "./root-cause-analyzer";

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

const DONE_LIKE: CardStatus[] = ["listo", "produccion", "archivado"];

function priorityRank(priority: string): number {
  return PRIORITY_ORDER[priority as PriorityLevel] ?? 9;
}

function sortByPriorityThenUpdated<T extends { priority: string; updatedAt?: string | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
    if (byPriority !== 0) return byPriority;
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
}

async function findCardByTitle(title: string) {
  const all = await db.select().from(tasks);
  const lower = title.toLowerCase();

  return (
    all.find((task) => task.title.toLowerCase() === lower) ??
    all.find((task) => task.title.toLowerCase().includes(lower))
  );
}

async function findProjectByName(name: string) {
  const all = await db.select().from(projects);
  const lower = name.toLowerCase();

  return (
    all.find((project) => project.name.toLowerCase() === lower) ??
    all.find((project) => project.name.toLowerCase().includes(lower)) ??
    all.find((project) => project.slug.toLowerCase().includes(lower))
  );
}

async function buildSentinelCard(taskId: string): Promise<SentinelCard | null> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return null;

  const checklist = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, taskId));

  return {
    id: task.id,
    title: task.title,
    description: task.description ?? undefined,
    status: task.status as SentinelCard["status"],
    type: task.type as SentinelCard["type"],
    priority: task.priority as SentinelCard["priority"],
    tags: (task.tags ?? []) as string[],
    projectId: task.projectId,
    checklist: checklist
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        text: item.text,
        status: item.status as SentinelCard["checklist"][number]["status"],
      })),
    codexLoop: task.codexLoop as SentinelCard["codexLoop"],
    fiveWhys: task.fiveWhys as SentinelCard["fiveWhys"],
    moneyCode: task.moneyCode as unknown as SentinelCard["moneyCode"],
    blocked: task.blocked,
    blockerReason: task.blockerReason ?? undefined,
    createdAt: task.createdAt ?? undefined,
  };
}

function executeHelp(): ActionResult {
  return {
    ok: true,
    message: [
      "Comandos disponibles:",
      "help",
      "status",
      'move "card title" to clarificando',
      "analyze backlog",
      'focus "card title"',
      'score "card title"',
    ].join("\n"),
    meta: { mode: "local" },
  };
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

  return { ok: true, message: `${date} | ${time}`, meta: { mode: "local" } };
}

async function executeStatus(): Promise<ActionResult> {
  const all = await db.select().from(tasks);
  const active = all.filter((task) => !DONE_LIKE.includes(task.status as CardStatus)).length;
  const blocked = all.filter((task) => task.blocked).length;
  const backlog = all.filter((task) => task.status === "idea_bruta").length;
  const inFlow = all.filter((task) =>
    ["clarificando", "validando", "en_proceso", "desarrollo", "qa"].includes(task.status),
  ).length;

  return {
    ok: true,
    message: [
      "SB CONNECTED",
      `${all.length} cards totales`,
      `${active} activas`,
      `${inFlow} en flujo`,
      `${backlog} en idea bruta`,
      `${blocked} bloqueadas`,
    ].join("\n"),
    data: { total: all.length, active, inFlow, backlog, blocked },
    meta: { mode: "local" },
  };
}

async function executeGetTopPriority(count: number): Promise<ActionResult> {
  const all = await db.select().from(tasks);
  const active = sortByPriorityThenUpdated(
    all.filter((task) => !DONE_LIKE.includes(task.status as CardStatus)),
  ).slice(0, count);

  if (active.length === 0) {
    await logDockEvent("command", `listar prioridades (${count}) -> sin tareas activas`);
    return { ok: true, message: "No hay tareas activas.", data: [], meta: { mode: "local" } };
  }

  const lines = active.map((task, index) => {
    const label = STATUS_LABELS[task.status as CardStatus] ?? task.status;
    return `${index + 1}. [${task.priority.toUpperCase()}] ${task.title} (${label})`;
  });

  await logDockEvent("command", `listar prioridades (${count})`);

  return {
    ok: true,
    message: lines.join("\n"),
    data: active.map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
    })),
    meta: { mode: "local" },
  };
}

async function executeMoveCard(title: string, status: string): Promise<ActionResult> {
  const card = await findCardByTitle(title);
  if (!card) {
    return { ok: false, message: `Card no encontrada: "${title}"` };
  }

  if (!(status in STATUS_LABELS)) {
    return { ok: false, message: `Estado invalido: "${status}"` };
  }

  if (card.status === status) {
    const label = STATUS_LABELS[status as CardStatus] ?? status;
    return { ok: true, message: `"${card.title}" ya esta en ${label}`, meta: { mode: "local" } };
  }

  const previousStatus = card.status;
  const oldLabel = STATUS_LABELS[previousStatus as CardStatus] ?? previousStatus;
  const newLabel = STATUS_LABELS[status as CardStatus] ?? status;

  await db
    .update(tasks)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, card.id));

  await logDockEvent("command", `"${card.title}" -> ${newLabel}`);

  return {
    ok: true,
    message: `"${card.title}": ${oldLabel} -> ${newLabel}`,
    meta: {
      affectedCardId: card.id,
      previousStatus,
      newStatus: status,
      projectId: card.projectId,
      mode: "local",
    },
    hint: "refresh_board",
  };
}

async function executeListTasks(projectQuery: string): Promise<ActionResult> {
  const all = await db.select().from(tasks);
  const filtered = projectQuery
    ? all.filter(
        (task) =>
          task.projectId.toLowerCase().includes(projectQuery.toLowerCase()) ||
          task.title.toLowerCase().includes(projectQuery.toLowerCase()),
      )
    : all;

  const active = sortByPriorityThenUpdated(
    filtered.filter((task) => task.status !== "archivado" && task.status !== "produccion"),
  );

  if (active.length === 0) {
    return { ok: true, message: "No hay tareas activas.", data: [], meta: { mode: "local" } };
  }

  const lines = active.map((task, index) => {
    const label = STATUS_LABELS[task.status as CardStatus] ?? task.status;
    return `${index + 1}. ${task.title} (${label}) [${task.priority}]`;
  });

  return {
    ok: true,
    message: `${active.length} tarea(s):\n${lines.join("\n")}`,
    data: active.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
    })),
    meta: { mode: "local" },
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
    meta: { affectedCardId: card.id, previousStatus: card.status, mode: "local" },
    hint: "refresh_board",
  };
}

async function executeAnalyzeRootCause(titleQuery: string): Promise<ActionResult> {
  if (!titleQuery) {
    return { ok: false, message: "Especifica la tarea: diagnosticar [nombre de tarea]" };
  }

  const task = await findCardByTitle(titleQuery);
  if (!task) {
    return { ok: false, message: `Card no encontrada: "${titleQuery}"` };
  }

  const checklist = await db
    .select()
    .from(taskChecklistItems)
    .where(eq(taskChecklistItems.taskId, task.id));

  const recentEventRows = await db.select().from(events).orderBy(desc(events.createdAt)).limit(10);
  const recentEvents = recentEventRows
    .filter((event) => event.message.includes(task.title))
    .map((event) => event.message);

  const analysis = analyzeRootCause({
    symptom: `Diagnostico de "${task.title}"`,
    taskId: task.id,
    projectId: task.projectId,
    currentStatus: task.status,
    recentEvents: recentEvents.length > 0 ? recentEvents : undefined,
    metadata: {
      title: task.title,
      blocked: task.blocked,
      blockerReason: task.blockerReason ?? undefined,
      priority: task.priority,
      type: task.type,
      tags: (task.tags ?? []) as string[],
      checklistTotal: checklist.length,
      checklistDone: checklist.filter((item) => item.status === "done").length,
      createdAt: task.createdAt,
      description: task.description ?? undefined,
    },
  });

  const sevLabel = analysis.severidad.toUpperCase();
  await logDockEvent("system", `Root cause [${sevLabel}]: ${analysis.causa_raiz.slice(0, 120)}`);

  const lines = [
    `"${task.title}" - Root Cause [${sevLabel}]`,
    `Confianza: ${analysis.confidence}%`,
    "",
    `Problema: ${analysis.problema_observable}`,
    `Causa inmediata: ${analysis.causa_inmediata}`,
    "",
    `1. ${analysis.por_que_1}`,
    `2. ${analysis.por_que_2}`,
    `3. ${analysis.por_que_3}`,
    `4. ${analysis.por_que_4}`,
    `5. ${analysis.por_que_5}`,
    "",
    `Causa raiz: ${analysis.causa_raiz}`,
    `Correctiva: ${analysis.accion_correctiva}`,
    `Preventiva: ${analysis.accion_preventiva}`,
  ];

  if (analysis.requiere_agente) {
    lines.push("", `Requiere agente: ${analysis.agente_sugerido ?? "por definir"}`);
  }

  return {
    ok: true,
    message: lines.join("\n"),
    data: analysis,
    meta: { affectedCardId: task.id, mode: "local" },
    hint: "refresh_board",
  };
}

async function executeListBacklog(): Promise<ActionResult> {
  const all = await db.select().from(tasks);
  const backlog = sortByPriorityThenUpdated(
    all.filter((task) => task.status === "idea_bruta" || task.blocked),
  );

  if (backlog.length === 0) {
    return { ok: true, message: "Backlog vacio.", data: [], meta: { mode: "local" } };
  }

  const lines = backlog.map((task, index) => {
    const label = STATUS_LABELS[task.status as CardStatus] ?? task.status;
    const blockedFlag = task.blocked ? " [BLOQUEADA]" : "";
    return `${index + 1}. [${task.priority.toUpperCase()}] ${task.title} (${label})${blockedFlag}`;
  });

  return {
    ok: true,
    message: `${backlog.length} item(s) en backlog:\n${lines.join("\n")}`,
    data: backlog.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      blocked: task.blocked,
    })),
    meta: { mode: "local" },
  };
}

async function executeSearch(query: string): Promise<ActionResult> {
  if (!query) {
    return { ok: false, message: "Falta texto de busqueda." };
  }

  const lower = query.toLowerCase();
  const [allTasks, allKnowledge] = await Promise.all([
    db.select().from(tasks),
    db.select().from(knowledgeEntries),
  ]);

  const filteredTasks = sortByPriorityThenUpdated(
    allTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(lower) ||
        (task.description ?? "").toLowerCase().includes(lower) ||
        ((task.tags ?? []) as string[]).some((tag) => tag.toLowerCase().includes(lower)),
    ),
  );

  const filteredKnowledge = allKnowledge.filter(
    (entry) =>
      entry.title.toLowerCase().includes(lower) ||
      (entry.summary ?? "").toLowerCase().includes(lower) ||
      entry.body.toLowerCase().includes(lower) ||
      ((entry.tags ?? []) as string[]).some((tag) => tag.toLowerCase().includes(lower)),
  );

  if (filteredTasks.length === 0 && filteredKnowledge.length === 0) {
    return { ok: true, message: `Sin resultados para "${query}".`, data: [], meta: { mode: "local" } };
  }

  const taskLines = filteredTasks.map((task, index) => {
    const label = STATUS_LABELS[task.status as CardStatus] ?? task.status;
    return `${index + 1}. ${task.title} (${label}) [${task.priority}]`;
  });

  const knowledgeLines = filteredKnowledge.map(
    (entry, index) => `${index + 1}. ${entry.title} (${entry.category})`,
  );

  const sections = [
    taskLines.length > 0 ? `Tareas:\n${taskLines.join("\n")}` : "",
    knowledgeLines.length > 0 ? `Knowledge:\n${knowledgeLines.join("\n")}` : "",
  ].filter(Boolean);

  return {
    ok: true,
    message: `${filteredTasks.length + filteredKnowledge.length} resultado(s) para "${query}":\n${sections.join("\n\n")}`,
    data: {
      tasks: filteredTasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
      })),
      knowledge: filteredKnowledge.map((entry) => ({
        id: entry.id,
        title: entry.title,
        category: entry.category,
        projectId: entry.projectId,
        sourceTaskId: entry.sourceTaskId,
      })),
    },
    meta: { mode: "local" },
  };
}

async function executeCreateTask(
  title: string,
  projectQuery: string,
  priority: string,
): Promise<ActionResult> {
  if (!title) {
    return { ok: false, message: "Falta el titulo de la tarea." };
  }

  const allProjects = await db.select().from(projects);
  if (allProjects.length === 0) {
    return { ok: false, message: "No hay proyectos cargados." };
  }

  let project = projectQuery ? await findProjectByName(projectQuery) : undefined;
  if (!project && projectQuery) {
    return {
      ok: false,
      message: `Proyecto no encontrado: "${projectQuery}".`,
      data: { available: allProjects.map((item) => item.name) },
    };
  }

  if (!project) {
    project = allProjects[0];
  }

  const validPriorities: PriorityLevel[] = ["low", "medium", "high", "critical"];
  const finalPriority = validPriorities.includes(priority as PriorityLevel)
    ? (priority as PriorityLevel)
    : "medium";

  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await db.insert(tasks).values({
    id,
    title,
    status: "idea_bruta",
    type: "task",
    priority: finalPriority,
    projectId: project.id,
    tags: [],
    blocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await logDockEvent("command", `Tarea creada: "${title}" en ${project.name}`);

  return {
    ok: true,
    message: `Tarea creada: "${title}" en ${project.name} | prioridad ${finalPriority}`,
    meta: { affectedCardId: id, projectId: project.id, mode: "local" },
    hint: "refresh_board",
  };
}

async function executeProjectSummary(projectQuery: string): Promise<ActionResult> {
  const project = await findProjectByName(projectQuery);
  if (!project) {
    return { ok: false, message: `Proyecto no encontrado: "${projectQuery}"` };
  }

  const all = await db.select().from(tasks);
  const projectTasks = all.filter((task) => task.projectId === project.id);

  const counts: Record<string, number> = {};
  for (const task of projectTasks) {
    counts[task.status] = (counts[task.status] || 0) + 1;
  }

  const total = projectTasks.length;
  const active = projectTasks.filter((task) => !DONE_LIKE.includes(task.status as CardStatus)).length;
  const blocked = projectTasks.filter((task) => task.blocked).length;

  const lines = [
    `Resumen - ${project.name}`,
    `Total: ${total} | Activas: ${active} | Bloqueadas: ${blocked}`,
    "",
    ...Object.entries(counts).map(([status, count]) => {
      const label = STATUS_LABELS[status as CardStatus] ?? status;
      return `${label}: ${count}`;
    }),
  ];

  return {
    ok: true,
    message: lines.join("\n"),
    data: { projectId: project.id, total, active, blocked, counts },
    meta: { mode: "local" },
  };
}

async function executeAnalyzeBacklog(): Promise<ActionResult> {
  const backlogRows = sortByPriorityThenUpdated(
    (await db.select().from(tasks)).filter((task) => task.status === "idea_bruta" || task.blocked),
  ).slice(0, 8);

  if (backlogRows.length === 0) {
    return {
      ok: true,
      message: "No hay backlog para analizar.",
      data: [],
      meta: { mode: "agent" },
    };
  }

  const analyses = await Promise.all(
    backlogRows.map(async (task) => {
      const card = await buildSentinelCard(task.id);
      if (!card) return null;

      const moneyCode = calculateMoneyCode(card);
      const action = suggestNextAction(card);

      return {
        id: card.id,
        title: card.title,
        score: moneyCode.total,
        label: moneyCode.label,
        action,
      };
    }),
  );

  const ranked = analyses
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.score - a.score);

  const lines = ranked.map(
    (item, index) =>
      `${index + 1}. ${item.title} [${item.score} ${item.label}] -> ${item.action.label} | ${item.action.command}`,
  );

  return {
    ok: true,
    message: lines.join("\n"),
    data: ranked,
    meta: { mode: "agent" },
  };
}

async function executeFocusCard(titleQuery: string): Promise<ActionResult> {
  const task = await findCardByTitle(titleQuery);
  if (!task) {
    return { ok: false, message: `Card no encontrada: "${titleQuery}"` };
  }

  const card = await buildSentinelCard(task.id);
  if (!card) {
    return { ok: false, message: `No se pudo hidratar la card: "${titleQuery}"` };
  }

  const loop = deriveCodexLoop(card);
  const action = suggestNextAction(card);

  return {
    ok: true,
    message: [
      `Focus: ${card.title}`,
      `Estado: ${STATUS_LABELS[card.status] ?? card.status}`,
      `Siguiente paso: ${loop.nextStep}`,
      `Comando sugerido: ${action.command}`,
    ].join("\n"),
    data: { loop, action },
    meta: {
      affectedCardId: card.id,
      projectId: card.projectId,
      mode: "local",
    },
  };
}

async function executeScoreCard(titleQuery: string): Promise<ActionResult> {
  const task = await findCardByTitle(titleQuery);
  if (!task) {
    return { ok: false, message: `Card no encontrada: "${titleQuery}"` };
  }

  const card = await buildSentinelCard(task.id);
  if (!card) {
    return { ok: false, message: `No se pudo hidratar la card: "${titleQuery}"` };
  }

  const score = calculateMoneyCode(card);

  return {
    ok: true,
    message: [
      `${card.title}`,
      `Score total: ${score.total}/100 (${score.label})`,
      `Revenue ${score.dimensions.revenue} | Savings ${score.dimensions.savings} | Automation ${score.dimensions.automation} | Reuse ${score.dimensions.reuse}`,
      `Execution ${score.dimensions.execution} | Validation ${score.dimensions.validation} | Strategic Fit ${score.dimensions.strategicFit} | Risk Control ${score.dimensions.riskControl}`,
      score.explanation,
    ].join("\n"),
    data: score,
    meta: {
      affectedCardId: card.id,
      projectId: card.projectId,
      mode: "local",
    },
  };
}

export async function executeAction(action: ResolvedAction): Promise<ActionResult> {
  switch (action.type) {
    case "HELP":
      return executeHelp();

    case "STATUS":
      return executeStatus();

    case "GET_TIME":
      return executeGetTime();

    case "GET_TOP_PRIORITY":
      return executeGetTopPriority(parseInt(action.args.count ?? "3", 10));

    case "MOVE_CARD":
      return executeMoveCard(action.args.title, action.args.status);

    case "LIST_TASKS":
      return executeListTasks(action.args.project ?? "");

    case "DELETE_CARD":
      return executeDeleteCard(action.args.title);

    case "ANALYZE_ROOT_CAUSE":
      return executeAnalyzeRootCause(action.args.title);

    case "LIST_BACKLOG":
      return executeListBacklog();

    case "LIST_PRIORITIES":
      return executeGetTopPriority(parseInt(action.args.count ?? "10", 10));

    case "SEARCH":
      return executeSearch(action.args.query);

    case "PROMOTE_CARD":
      return executeMoveCard(action.args.title, action.args.status);

    case "CREATE_TASK":
      return executeCreateTask(
        action.args.title,
        action.args.project ?? "",
        action.args.priority ?? "medium",
      );

    case "PROJECT_SUMMARY":
      return executeProjectSummary(action.args.project);

    case "ANALYZE_BACKLOG":
      return executeAnalyzeBacklog();

    case "FOCUS_CARD":
      return executeFocusCard(action.args.title);

    case "SCORE_CARD":
      return executeScoreCard(action.args.title);

    default:
      return { ok: false, message: `Accion desconocida: ${(action as ResolvedAction).type}` };
  }
}
