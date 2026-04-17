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
  "desarrollo": "desarrollo",
  "dev": "desarrollo",
  "qa": "qa",
  "listo": "listo",
  "produccion": "produccion",
  "producción": "produccion",
  "archivado": "archivado",
  "archivar": "archivado",
};

function normalizeStatus(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return STATUS_ALIASES[key] ?? null;
}

export function resolveAction(command: string): ResolvedAction | null {
  const cmd = command.trim().toLowerCase();

  if (/^(qu[ée]\s+hora|hora\s+actual|timestamp|time)/.test(cmd)) {
    return { type: "GET_TIME", args: {} };
  }

  if (/priorid|priority|top\s+\d|lista.*(alta|high|cr[ií]tic|prior)/.test(cmd)) {
    const countMatch = cmd.match(/(\d+)/);
    return {
      type: "GET_TOP_PRIORITY",
      args: { count: countMatch?.[1] ?? "3" },
    };
  }

  const moveMatch = command.match(
    /(?:mueve|mover|move)\s+["«"]([^"»"]+)["»"]\s+(?:a|to)\s+(.+)/i,
  );
  if (moveMatch) {
    const title = moveMatch[1].trim();
    const statusRaw = moveMatch[2].trim();
    const status = normalizeStatus(statusRaw);
    if (status) {
      return { type: "MOVE_CARD", args: { title, status } };
    }
  }

  return null;
}
