/**
 * copilot-client.ts
 *
 * Client-side helper for POST /api/copilot/respond.
 * Used by the dock to escalate non-parsed inputs to the AI router.
 */

import type { CopilotCardContext } from "@/lib/server/copilot-prompt";

export type CopilotProvider =
  | "ollama"
  | "openrouter"
  | "anthropic"
  | "heuristic"
  | "none";

export interface CopilotReply {
  ok: boolean;
  provider: CopilotProvider;
  text: string;
  suggestedCommand: string | null;
  error?: string;
}

export interface AskCopilotInput {
  message: string;
  card?: CopilotCardContext;
  projectName?: string;
}

export async function askCopilot(
  input: AskCopilotInput,
  signal?: AbortSignal,
): Promise<CopilotReply> {
  try {
    const res = await fetch("/api/copilot/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });

    const json = (await res.json()) as Partial<CopilotReply> & {
      ok?: boolean;
      provider?: string;
    };

    if (!res.ok || !json.ok) {
      return {
        ok: false,
        provider: (json.provider as CopilotProvider) ?? "none",
        text: typeof json.text === "string" ? json.text : "",
        suggestedCommand: null,
        error: json.error ?? `HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      provider: (json.provider as CopilotProvider) ?? "heuristic",
      text: typeof json.text === "string" ? json.text : "",
      suggestedCommand:
        typeof json.suggestedCommand === "string" && json.suggestedCommand.trim()
          ? json.suggestedCommand.trim()
          : null,
    };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return {
        ok: false,
        provider: "none",
        text: "",
        suggestedCommand: null,
        error: "Solicitud cancelada",
      };
    }
    return {
      ok: false,
      provider: "none",
      text: "",
      suggestedCommand: null,
      error: err instanceof Error ? err.message : "Error de red",
    };
  }
}
