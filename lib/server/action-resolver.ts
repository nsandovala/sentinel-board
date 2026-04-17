/**
 * action-resolver.ts
 *
 * Purpose: Pattern-match terminal commands against known local actions
 * BEFORE hitting the AI router. If a command matches, return the action
 * type and parsed arguments. If not, return null so the runner falls
 * through to the LLM.
 *
 * Input:  raw command string
 * Output: ResolvedAction | null
 *
 * No dependencies on AI, store, or DB — pure parsing.
 */

export type ActionType = "GET_TOP_PRIORITY" | "MOVE_CARD" | "GET_TIME";

export interface ResolvedAction {
  type: ActionType;
  args: Record<string, string>;
}

const STATUS_ALIASES: Record<string, string> = {
  "idea bruta": "idea_bruta",
  "idea": "idea_bruta",
  "clarificando": "clarificando",
  "clarificar": "clarificando",
  "validando": "validando",
  "validar": "validando",
  "en proceso": "en_proceso",
  "en_proceso": "en_proceso",
  "proceso": "en_proceso",
  "desarrollo": "desarrollo",
  "dev": "desarrollo",
  "qa": "qa",
  "listo": "listo",
  "hecho": "listo",
  "done": "listo",
  "produccion": "produccion",
  "producción": "produccion",
  "prod": "produccion",
  "archivado": "archivado",
  "archivar": "archivado",
  "archivo": "archivado",
  "bloqueado": "en_proceso",
};

const STATUS_KEYS = Object.keys(STATUS_ALIASES).sort((a, b) => b.length - a.length);

const MOVE_VERBS = /^(?:mueve|mover|move|pasa|pasar|manda|mandar|lleva|llevar|pon|poner|cambia|cambiar)\s+/i;

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
    if (match) {
      let title = afterVerb.slice(0, match.index!).trim();
      title = stripQuotes(title);
      if (title.length > 0) {
        const status = STATUS_ALIASES[key]!;
        return { title, status };
      }
    }
  }

  return null;
}

function stripQuotes(s: string): string {
  return s.replace(/^["«"'\u2018\u201C]+|["»"'\u2019\u201D]+$/g, "");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolveAction(command: string): ResolvedAction | null {
  const cmd = command.trim();
  const lower = cmd.toLowerCase();

  if (/^(qu[ée]\s+hora|hora\s+actual|timestamp|time)/.test(lower)) {
    return { type: "GET_TIME", args: {} };
  }

  if (/priorid|priority|top\s+\d|lista.*(alta|high|cr[ií]tic|prior)/.test(lower)) {
    const countMatch = lower.match(/(\d+)/);
    return {
      type: "GET_TOP_PRIORITY",
      args: { count: countMatch?.[1] ?? "3" },
    };
  }

  const moveResult = tryParseMove(cmd);
  if (moveResult) {
    return {
      type: "MOVE_CARD",
      args: { title: moveResult.title, status: moveResult.status },
    };
  }

  return null;
}
