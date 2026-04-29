/**
 * root-cause-analyzer.ts
 *
 * Heuristic 5-Whys engine. Produces a structured RootCauseAnalysis
 * with severidad, confidence 0-100, and multi-agent readiness flags.
 * 100% deterministic — no LLM calls.
 */

import { STATUS_LABELS } from "@/lib/console/status-labels";
import type { CardStatus } from "@/types/enums";
import type {
  RootCauseInput,
  RootCauseAnalysis,
  Severidad,
} from "@/types/root-cause";

export type { RootCauseInput, RootCauseAnalysis };

function label(status?: string): string {
  if (!status) return "desconocido";
  return STATUS_LABELS[status as CardStatus] ?? status;
}

function ageDays(createdAt?: string): number | null {
  if (!createdAt) return null;
  try {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  } catch { return null; }
}

function makeId(): string {
  return `rca-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function inferSeveridad(
  priority?: string,
  blocked?: boolean,
  isStale?: boolean,
): Severidad {
  if (blocked && (priority === "critical" || priority === "high")) return "critica";
  if (priority === "critical") return "critica";
  if (blocked || priority === "high") return "alta";
  if (isStale) return "media";
  return "baja";
}

function inferAgent(
  type?: string,
  severidad?: Severidad,
): { requiere: boolean; sugerido?: string } {
  if (severidad === "critica")
    return { requiere: true, sugerido: type === "bug" ? "qa-reviewer" : "state-guardian" };
  if (type === "bug")
    return { requiere: true, sugerido: "qa-reviewer" };
  return { requiere: false };
}

export function analyzeRootCause(input: RootCauseInput): RootCauseAnalysis {
  const { symptom, taskId, projectId, metadata: m, recentEvents, currentStatus } = input;
  const meta = m ?? {};
  const evidencia: string[] = [];
  const supuestos: string[] = [];

  const age = ageDays(meta.createdAt);
  const progress =
    meta.checklistTotal && meta.checklistTotal > 0
      ? meta.checklistDone! / meta.checklistTotal
      : null;
  const isBlocked = meta.blocked === true;
  const isEarlyStage = ["idea_bruta", "clarificando"].includes(currentStatus ?? "");
  const isStale = age !== null && age > 30;
  const hasLowProgress = progress !== null && progress < 0.3;

  if (meta.title) evidencia.push(`Tarea: "${meta.title}"`);
  if (currentStatus) evidencia.push(`Estado: ${label(currentStatus)}`);
  if (age !== null) evidencia.push(`Antigüedad: ${age} días`);
  if (progress !== null) evidencia.push(`Checklist: ${Math.round(progress * 100)}%`);
  if (isBlocked) evidencia.push(`Bloqueada: ${meta.blockerReason ?? "sin razón"}`);
  if (recentEvents?.length) evidencia.push(`${recentEvents.length} eventos recientes`);

  const sev = inferSeveridad(meta.priority, isBlocked, isStale);
  const agent = inferAgent(meta.type, sev);
  const base = {
    id: makeId(),
    taskId,
    projectId,
    severidad: sev,
    requiere_agente: agent.requiere,
    agente_sugerido: agent.sugerido,
    evidencia,
    createdAt: new Date().toISOString(),
  };

  // ── Path: Blocked ──
  if (isBlocked) {
    const reason = meta.blockerReason ?? "dependencia o recurso externo no disponible";
    return {
      ...base,
      problema_observable: symptom || `"${meta.title ?? "Tarea"}" está bloqueada`,
      causa_inmediata: `Existe un bloqueador activo que impide avance`,
      por_que_1: `La tarea no puede avanzar por un bloqueador: ${reason}`,
      por_que_2: `No se ha resuelto la dependencia o condición necesaria`,
      por_que_3: isStale
        ? `Lleva ${age} días sin resolución del bloqueo`
        : `No hay plan claro para resolver el bloqueo`,
      por_que_4: `No se escaló ni se asignó ownership del bloqueo`,
      por_que_5: `Falta proceso de revisión periódica de bloqueos`,
      causa_raiz: `Bloqueo sin resolución: ${reason}`,
      confidence: meta.blockerReason ? 85 : 60,
      accion_correctiva: `Resolver el bloqueo (${reason}) o redefinir la tarea`,
      accion_preventiva: `Definir criterios de desbloqueo al crear tareas y revisar bloqueos semanalmente`,
      supuestos: meta.blockerReason
        ? []
        : ["No hay razón de bloqueo especificada — se infiere dependencia externa (hipótesis)"],
    };
  }

  // ── Path: Stale + early stage ──
  if (isStale && isEarlyStage) {
    supuestos.push("Se asume que la tarea no fue priorizada activamente (hipótesis: antigüedad + estado)");
    return {
      ...base,
      problema_observable: symptom || `"${meta.title ?? "Tarea"}" lleva ${age} días en ${label(currentStatus)}`,
      causa_inmediata: `La tarea no avanzó de etapa temprana en ${age} días`,
      por_que_1: `Se creó hace ${age} días y sigue en ${label(currentStatus)}`,
      por_que_2: `No fue promovida a una etapa activa de trabajo`,
      por_que_3: `No se clarificó el alcance o la prioridad real`,
      por_que_4: `No hay ciclo de revisión que rescate tareas estancadas`,
      por_que_5: `Falta proceso de triage periódico`,
      causa_raiz: `Tarea sin triage: ${age} días en ${label(currentStatus)}, nunca promovida`,
      confidence: 55,
      accion_correctiva: `Evaluar relevancia: mover a clarificando o archivar`,
      accion_preventiva: `Revisión semanal de ideas brutas con más de 14 días`,
      supuestos,
    };
  }

  // ── Path: Low checklist progress ──
  if (hasLowProgress && !isEarlyStage) {
    const pct = Math.round(progress! * 100);
    return {
      ...base,
      problema_observable: symptom || `"${meta.title ?? "Tarea"}" tiene solo ${pct}% de checklist`,
      causa_inmediata: `Progreso de checklist insuficiente para el estado actual`,
      por_que_1: `En ${label(currentStatus)} pero solo ${pct}% completado`,
      por_que_2: `Las subtareas no se ejecutan al ritmo esperado`,
      por_que_3: meta.priority === "low"
        ? `La prioridad baja posterga frente a otras tareas`
        : `El alcance del checklist es mayor al estimado`,
      por_que_4: `No hay visibilidad del bottleneck dentro del checklist`,
      por_que_5: `Falta desglose o reestimación de subtareas`,
      causa_raiz: `Progreso insuficiente: ${meta.checklistDone}/${meta.checklistTotal} en ${label(currentStatus)}`,
      confidence: 50,
      accion_correctiva: `Identificar la subtarea más bloqueante y atacarla primero`,
      accion_preventiva: `Verificar checklist al mover tareas a desarrollo`,
      supuestos: ["Se asume que el checklist refleja el alcance real (hipótesis)"],
    };
  }

  // ── Path: High priority stuck in early stage ──
  if ((meta.priority === "critical" || meta.priority === "high") && isEarlyStage) {
    return {
      ...base,
      problema_observable: symptom || `"${meta.title ?? "Tarea"}" es ${meta.priority} pero sigue en ${label(currentStatus)}`,
      causa_inmediata: `Tarea de alta prioridad sin plan de ejecución`,
      por_que_1: `Marcada como ${meta.priority} pero no entró en ejecución`,
      por_que_2: `Sigue en ${label(currentStatus)} — sin clarificación completa`,
      por_que_3: `Se priorizó sin plan de ejecución concreto`,
      por_que_4: `No hay alineamiento entre urgencia y capacidad de ejecución`,
      por_que_5: `Falta mecanismo de escalamiento automático para tareas críticas`,
      causa_raiz: `Desalineamiento prioridad-ejecución: ${meta.priority} en ${label(currentStatus)}`,
      confidence: 80,
      accion_correctiva: `Clarificar inmediatamente y mover a en_proceso o desarrollo`,
      accion_preventiva: `Tareas critical/high deben tener plan de ejecución en <48h`,
      supuestos: [],
    };
  }

  // ── Path: Generic / insufficient data ──
  const hasEvents = (recentEvents?.length ?? 0) > 0;
  supuestos.push("Análisis con datos limitados — agregar más contexto para mayor precisión (hipótesis)");

  return {
    ...base,
    confidence: 25,
    problema_observable: symptom || `Situación a diagnosticar en "${meta.title ?? "tarea"}"`,
    causa_inmediata: symptom
      ? `El síntoma reportado indica un problema activo`
      : `No se especificó síntoma claro`,
    por_que_1: `Síntoma: ${symptom || "no especificado"}`,
    por_que_2: hasEvents
      ? `Eventos recientes sugieren actividad sin resolución`
      : `No hay eventos recientes que indiquen progreso`,
    por_que_3: currentStatus
      ? `El estado (${label(currentStatus)}) puede no reflejar la realidad`
      : `No se conoce el estado actual`,
    por_que_4: `Falta información adicional para profundizar`,
    por_que_5: `Se necesita revisión en detalle del contexto`,
    causa_raiz: `Diagnóstico incompleto — se requiere más contexto`,
    accion_correctiva: `Revisar la tarea, agregar contexto y re-ejecutar el análisis`,
    accion_preventiva: `Mantener metadata actualizada (bloqueadores, checklist, status)`,
    supuestos,
  };
}
