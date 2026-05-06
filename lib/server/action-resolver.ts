/**
 * action-resolver.ts
 *
 * Purpose: Pattern-match terminal commands against known local actions.
 * No AI fallback is required for the IDE terminal workflow.
 */

export type ActionType =
  | "HELP"
  | "STATUS"
  | "GET_TOP_PRIORITY"
  | "MOVE_CARD"
  | "GET_TIME"
  | "LIST_TASKS"
  | "DELETE_CARD"
  | "ANALYZE_ROOT_CAUSE"
  | "LIST_BACKLOG"
  | "LIST_PRIORITIES"
  | "SEARCH"
  | "PROMOTE_CARD"
  | "CREATE_TASK"
  | "PROJECT_SUMMARY"
  | "ANALYZE_BACKLOG"
  | "FOCUS_CARD"
  | "SCORE_CARD";

export interface ResolvedAction {
  type: ActionType;
  args: Record<string, string>;
}

const STATUS_ALIASES: Record<string, string> = {
  "idea bruta": "idea_bruta",
  idea: "idea_bruta",
  clarificando: "clarificando",
  clarificar: "clarificando",
  validando: "validando",
  validar: "validando",
  "en proceso": "en_proceso",
  en_proceso: "en_proceso",
  proceso: "en_proceso",
  desarrollo: "desarrollo",
  dev: "desarrollo",
  qa: "qa",
  listo: "listo",
  hecho: "listo",
  done: "listo",
  produccion: "produccion",
  produccion_: "produccion",
  prod: "produccion",
  archivado: "archivado",
  archivar: "archivado",
  archivo: "archivado",
  bloqueado: "en_proceso",
};

const STATUS_KEYS = Object.keys(STATUS_ALIASES)
  .map((key) => key.replace(/_$/, ""))
  .sort((a, b) => b.length - a.length);

const MOVE_VERBS =
  /^(?:mueve|mover|move|pasa|pasar|manda|mandar|lleva|llevar|pon|poner|cambia|cambiar)\s+/i;
const PROMOTE_VERBS =
  /^(?:promover|promueve|promocionar|promociona|eleva|elevar|sube|subir|escalar|promote)\s+/i;

function stripQuotes(value: string): string {
  return value.replace(/^["'`]+|["'`]+$/g, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchSingleArg(command: string, patterns: RegExp[]): { value: string } | null {
  for (const re of patterns) {
    const match = command.match(re);
    if (!match?.[1]) continue;
    const value = stripQuotes(match[1].trim());
    if (value) return { value };
  }

  return null;
}

function tryParseMove(command: string): { title: string; status: string } | null {
  const verbMatch = command.match(MOVE_VERBS);
  if (!verbMatch) return null;

  const afterVerb = command.slice(verbMatch[0].length);

  for (const key of STATUS_KEYS) {
    const suffixPattern = new RegExp(
      `\\s+(?:a|al?|to|hacia|para)\\s+${escapeRegex(key)}\\s*$`,
      "i",
    );
    const match = afterVerb.match(suffixPattern);
    if (!match) continue;

    const title = stripQuotes(afterVerb.slice(0, match.index!).trim());
    if (!title) continue;

    return { title, status: STATUS_ALIASES[key] ?? STATUS_ALIASES[`${key}_`] ?? key };
  }

  return null;
}

function tryParsePromote(command: string): { title: string; status: string } | null {
  const verbMatch = command.match(PROMOTE_VERBS);
  if (!verbMatch) return null;

  const afterVerb = command.slice(verbMatch[0].length);
  const moved = tryParseMove(`move ${afterVerb}`);
  if (moved) return moved;

  const title = stripQuotes(afterVerb.trim());
  if (!title) return null;

  return { title, status: "clarificando" };
}

function tryParseCreateTask(command: string): { title: string; project?: string; priority?: string } | null {
  const patterns = [
    /^(?:crear|nueva|nuevo|agregar|add|anadir|anade)\s+(?:task|tarea)\s+["']([^"']+)["']\s+(?:en|@)\s+(.+?)\s+(?:prioridad|priority)\s+(low|medium|high|critical)$/i,
    /^(?:crear|nueva|nuevo|agregar|add|anadir|anade)\s+(?:task|tarea)\s+["']([^"']+)["']\s+(?:en|@)\s+(.+?)$/i,
    /^(?:crear|nueva|nuevo|agregar|add|anadir|anade)\s+(?:task|tarea)\s+(.+?)\s+(?:en|@)\s+(.+?)\s+(?:prioridad|priority)\s+(low|medium|high|critical)$/i,
    /^(?:crear|nueva|nuevo|agregar|add|anadir|anade)\s+(?:task|tarea)\s+(.+?)\s+(?:en|@)\s+(.+?)$/i,
    /^(?:crear|nueva|nuevo|agregar|add|anadir|anade)\s+(?:task|tarea)\s+["']([^"']+)["']$/i,
    /^(?:crear|nueva|nuevo|agregar|add|anadir|anade)\s+(?:task|tarea)\s+(.+)$/i,
  ];

  for (const re of patterns) {
    const match = command.match(re);
    if (!match) continue;
    const title = stripQuotes(match[1].trim());
    const project = match[2]?.trim();
    const priority = match[3]?.trim().toLowerCase();
    if (title) {
      return { title, project, priority };
    }
  }

  return null;
}

function tryParseSearch(command: string): { query: string } | null {
  const result = matchSingleArg(command, [
    /^buscar\s+(.+)$/i,
    /^busca\s+(.+)$/i,
    /^search\s+(.+)$/i,
    /^find\s+(.+)$/i,
  ]);

  return result ? { query: result.value } : null;
}

function tryParseProjectSummary(command: string): { project: string } | null {
  const result = matchSingleArg(command, [
    /^resumen\s+(?:de\s+)?proyecto\s+(.+)$/i,
    /^resumen\s+proyecto\s+(.+)$/i,
    /^project\s+summary\s+(.+)$/i,
    /^resumen\s+(.+)$/i,
  ]);

  return result ? { project: result.value } : null;
}

function tryParseDiagnose(command: string): { title: string } | null {
  const result = matchSingleArg(command, [
    /^diagnosticar\s+["']([^"']+)["']$/i,
    /^diagnosticar\s+(.+)$/i,
    /^diagnostico\s+["']([^"']+)["']$/i,
    /^diagnostico\s+(.+)$/i,
    /^analizar\s+causa\s+["']([^"']+)["']$/i,
    /^analizar\s+causa\s+(.+)$/i,
    /^root\.cause\s+["']([^"']+)["']$/i,
    /^root\.cause\s+(.+)$/i,
  ]);

  return result ? { title: result.value } : null;
}

function tryParseDelete(command: string): { title: string } | null {
  const result = matchSingleArg(command, [
    /^eliminar\s+(?:tarea|task|card)?\s*["']([^"']+)["']$/i,
    /^eliminar\s+(?:tarea|task|card)?\s+(.+)$/i,
    /^borrar\s+(?:tarea|task|card)?\s*["']([^"']+)["']$/i,
    /^borrar\s+(?:tarea|task|card)?\s+(.+)$/i,
    /^delete\s+(?:tarea|task|card)?\s*["']([^"']+)["']$/i,
    /^delete\s+(?:tarea|task|card)?\s+(.+)$/i,
    /^rm\s+["']([^"']+)["']$/i,
    /^rm\s+(.+)$/i,
  ]);

  return result ? { title: result.value } : null;
}

function tryParseFocus(command: string): { title: string } | null {
  const result = matchSingleArg(command, [
    /^focus\s+["']([^"']+)["']$/i,
    /^focus\s+(.+)$/i,
    /^enfocar\s+["']([^"']+)["']$/i,
    /^enfocar\s+(.+)$/i,
  ]);

  return result ? { title: result.value } : null;
}

function tryParseScore(command: string): { title: string } | null {
  const result = matchSingleArg(command, [
    /^score\s+["']([^"']+)["']$/i,
    /^score\s+(.+)$/i,
    /^scoring\s+["']([^"']+)["']$/i,
    /^scoring\s+(.+)$/i,
  ]);

  return result ? { title: result.value } : null;
}

export function resolveAction(command: string): ResolvedAction | null {
  const cmd = command.trim();
  const lower = cmd.toLowerCase();

  if (/^(?:help|ayuda|\?)$/i.test(cmd)) {
    return { type: "HELP", args: {} };
  }

  if (/^(?:status|estado|sb\s+status)$/i.test(cmd)) {
    return { type: "STATUS", args: {} };
  }

  if (/^(?:analyze|analizar)\s+backlog$/i.test(cmd)) {
    return { type: "ANALYZE_BACKLOG", args: {} };
  }

  if (/^(?:que\s+hora|hora\s+actual|timestamp|time)$/i.test(lower)) {
    return { type: "GET_TIME", args: {} };
  }

  if (/^(?:listar\s+backlog|ver\s+backlog|backlog)$/i.test(cmd)) {
    return { type: "LIST_BACKLOG", args: {} };
  }

  if (
    /^(?:listar\s+prioridades|listar\s+prioridad|ver\s+prioridades|prioridades)$/i.test(cmd) ||
    /^top\s+\d+\s*(?:tareas|tasks|prioridades?)$/i.test(cmd)
  ) {
    const countMatch = lower.match(/(\d+)/);
    return { type: "LIST_PRIORITIES", args: { count: countMatch?.[1] ?? "10" } };
  }

  if (/priorid|priority|top\s+\d|lista.*(alta|high|critical|prior)/.test(lower)) {
    const countMatch = lower.match(/(\d+)/);
    return { type: "GET_TOP_PRIORITY", args: { count: countMatch?.[1] ?? "3" } };
  }

  if (/^(?:listar\s+tareas|ver\s+tareas|mostrar\s+tareas|tareas)$/i.test(cmd)) {
    return { type: "LIST_TASKS", args: {} };
  }

  const searchResult = tryParseSearch(cmd);
  if (searchResult) {
    return { type: "SEARCH", args: { query: searchResult.query } };
  }

  const focusResult = tryParseFocus(cmd);
  if (focusResult) {
    return { type: "FOCUS_CARD", args: { title: focusResult.title } };
  }

  const scoreResult = tryParseScore(cmd);
  if (scoreResult) {
    return { type: "SCORE_CARD", args: { title: scoreResult.title } };
  }

  const promoteResult = tryParsePromote(cmd);
  if (promoteResult) {
    return {
      type: "PROMOTE_CARD",
      args: { title: promoteResult.title, status: promoteResult.status },
    };
  }

  const moveResult = tryParseMove(cmd);
  if (moveResult) {
    return { type: "MOVE_CARD", args: { title: moveResult.title, status: moveResult.status } };
  }

  const createResult = tryParseCreateTask(cmd);
  if (createResult) {
    return {
      type: "CREATE_TASK",
      args: {
        title: createResult.title,
        project: createResult.project ?? "",
        priority: createResult.priority ?? "medium",
      },
    };
  }

  const diagnoseResult = tryParseDiagnose(cmd);
  if (diagnoseResult) {
    return { type: "ANALYZE_ROOT_CAUSE", args: { title: diagnoseResult.title } };
  }

  const deleteResult = tryParseDelete(cmd);
  if (deleteResult) {
    return { type: "DELETE_CARD", args: { title: deleteResult.title } };
  }

  const summaryResult = tryParseProjectSummary(cmd);
  if (summaryResult) {
    return { type: "PROJECT_SUMMARY", args: { project: summaryResult.project } };
  }

  return null;
}
