import type { CodexLoopData } from "@/types/card";
import { generateCodexLoop } from "@/lib/console/codex-loop-generator";

export interface LocalAnalysisResult {
  summary: string;
  tasks: string[];
  risks: string[];
  nextSteps: string[];
  codexLoop: CodexLoopData;
  /** Short preview of input for the log */
  sourcePreview: string;
}

/** Cadena estable para comparar títulos (sin acentos, puntuación colapsada). */
export function normalizeTaskTitleForDedupe(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const row: number[] = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) row[j] = j;
  for (let i = 1; i <= al; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= bl; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[bl]!;
}

const MAX_COMPARE_LEN = 96;

/**
 * Duplicado exacto (normalizado) o muy parecido (contención / Levenshtein acotado).
 */
export function areTaskTitlesDuplicateOrSimilar(a: string, b: string): boolean {
  const na = normalizeTaskTitleForDedupe(a);
  const nb = normalizeTaskTitleForDedupe(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen < 4) return false;
  const short = na.length <= nb.length ? na : nb;
  const long = na.length > nb.length ? na : nb;
  if (long.includes(short) && short.length / long.length >= 0.82) return true;
  const sa = na.slice(0, MAX_COMPARE_LEN);
  const sb = nb.slice(0, MAX_COMPARE_LEN);
  const ref = Math.min(sa.length, sb.length);
  const threshold = Math.max(1, Math.floor(ref * 0.12));
  return levenshteinDistance(sa, sb) <= threshold;
}

/** Quita tareas casi repetidas dentro de la misma lista (conserva la primera redacción). */
export function dedupeNearDuplicateTasks(tasks: string[]): string[] {
  const out: string[] = [];
  for (const t of tasks) {
    const trimmed = t.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    if (out.some((existing) => areTaskTitlesDuplicateOrSimilar(existing, trimmed))) continue;
    out.push(trimmed);
  }
  return out;
}

function firstParagraph(text: string): string {
  const t = text.trim();
  const idx = t.search(/\n\n/);
  const chunk = idx >= 0 ? t.slice(0, idx) : t;
  return chunk.length > 320 ? `${chunk.slice(0, 317)}…` : chunk;
}

function extractBulletLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^[-*•]\s+(.+)/) ?? line.match(/^\d+[.)]\s+(.+)/);
    if (m?.[1]) out.push(m[1].trim());
  }
  return out.slice(0, 8);
}

/**
 * Deterministic local analysis — no LLM. Prepares the same shape
 * future Ollama/LM Studio responses will fill.
 */
export function runLocalAnalysis(raw: string): LocalAnalysisResult {
  const text = raw.trim();
  if (!text) {
    return {
      summary: "Pega o escribe contexto para analizar.",
      tasks: [],
      risks: ["Sin texto no hay riesgos identificables."],
      nextSteps: ["Escribe notas, requisitos o problemas y vuelve a analizar."],
      codexLoop: generateCodexLoop({
        id: "draft",
        title: "Borrador",
        status: "idea_bruta",
        type: "task",
        priority: "medium",
        tags: [],
        projectId: "5",
        checklist: [],
      }),
      sourcePreview: "",
    };
  }

  const summary = firstParagraph(text) || text.slice(0, 200);
  let tasks = extractBulletLines(text);
  if (tasks.length === 0) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 15);
    tasks = sentences.slice(0, 3).map((s) => s.replace(/\.$/, ""));
  }
  tasks = dedupeNearDuplicateTasks(tasks);

  const risks: string[] = [];
  if (/riesgo|blocker|bloqueo|dependencia|incertidumbre/i.test(text)) {
    risks.push("El texto menciona riesgos o bloqueos — revisar dependencias antes de comprometer fechas.");
  }
  risks.push("Análisis heurístico: validar supuestos con datos reales cuando conectes IA local.");

  const nextSteps: string[] = [];
  if (tasks.length > 0) {
    nextSteps.push(`Priorizar: ${tasks[0]}`);
  }
  nextSteps.push("Desglosar la siguiente acción en una tarjeta en el board.");
  nextSteps.push("Cuando actives IA local, pedir validación explícita de hipótesis.");

  const titleLine = text.split(/\r?\n/)[0]?.trim() || "Contexto";
  const rest = text.slice(titleLine.length).trim();
  const codexLoop = generateCodexLoop({
    id: "analysis-draft",
    title: titleLine.slice(0, 120),
    description: rest || summary,
    status: "clarificando",
    type: "task",
    priority: "medium",
    tags: ["análisis"],
    projectId: "5",
    checklist: [],
  });

  const sourcePreview =
    text.length > 80 ? `${text.slice(0, 77)}…` : text;

  return {
    summary,
    tasks,
    risks,
    nextSteps,
    codexLoop,
    sourcePreview,
  };
}
