import type { LocalAnalysisResult } from "@/lib/console/local-analysis";
import type { CodexLoopData } from "@/types/card";

export interface PlannerResponse {
  summary: string;
  objective: string;
  hypothesis: string;
  risks: string[];
  next_steps: string[];
  backlog_tasks: string[];
  codex_loop: {
    problem: string;
    objective: string;
    hypothesis: string;
    solution: string;
    validation: string;
    next_step: string;
  };
}

/**
 * Extracts JSON from raw model output — handles markdown fences,
 * leading/trailing prose, and common escape issues.
 */
export function safeParseJSON(raw: string): unknown | null {
  const trimmed = raw.trim();

  const fenced = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    // noop
  }

  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(candidate.slice(first, last + 1));
    } catch {
      // noop
    }
  }

  return null;
}

function asStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function asString(val: unknown, fallback = ""): string {
  return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

/**
 * Normalizes raw parsed JSON into a valid PlannerResponse,
 * filling missing fields with safe defaults.
 */
export function normalizePlannerResponse(raw: unknown): PlannerResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const summary = asString(obj.summary);
  if (!summary) return null;

  const cl = (obj.codex_loop ?? obj.codexLoop ?? {}) as Record<string, unknown>;

  return {
    summary,
    objective: asString(obj.objective, summary),
    hypothesis: asString(obj.hypothesis, "Por validar"),
    risks: asStringArray(obj.risks),
    next_steps: asStringArray(obj.next_steps ?? obj.nextSteps),
    backlog_tasks: asStringArray(obj.backlog_tasks ?? obj.backlogTasks ?? obj.tasks),
    codex_loop: {
      problem: asString(cl.problem, summary),
      objective: asString(cl.objective, asString(obj.objective)),
      hypothesis: asString(cl.hypothesis, asString(obj.hypothesis)),
      solution: asString(cl.solution),
      validation: asString(cl.validation),
      next_step: asString(cl.next_step ?? cl.nextStep),
    },
  };
}

/**
 * Converts a normalized PlannerResponse into the LocalAnalysisResult shape
 * that AnalysisPreview already knows how to render.
 */
export function plannerToLocalAnalysis(
  planner: PlannerResponse,
  sourceText: string,
): LocalAnalysisResult {
  const codexLoop: CodexLoopData = {
    problem: planner.codex_loop.problem,
    objective: planner.codex_loop.objective,
    hypothesis: planner.codex_loop.hypothesis,
    solution: planner.codex_loop.solution || undefined,
    validation: planner.codex_loop.validation || undefined,
    nextStep: planner.codex_loop.next_step || undefined,
  };

  const sourcePreview =
    sourceText.length > 80 ? `${sourceText.slice(0, 77)}…` : sourceText;

  return {
    summary: planner.summary,
    tasks: planner.backlog_tasks,
    risks: planner.risks.length > 0 ? planner.risks : ["Sin riesgos identificados."],
    nextSteps: planner.next_steps.length > 0 ? planner.next_steps : [planner.objective],
    codexLoop,
    sourcePreview,
  };
}
