import type { AgentRunResult, AgentRunInput } from "@/types/agent";
import { loadAgent } from "./load-agent";
import { buildAgentPrompt } from "./build-agent-prompt";
import { safeParseJSON } from "./parse-planner-response";
import { routeAI } from "@/lib/ai/ai-router";

export default async function runAgent(
  agentName: string,
  input: AgentRunInput,
): Promise<AgentRunResult> {
  const agent = loadAgent(agentName);
  const { systemPrompt, userPrompt } = buildAgentPrompt(agent, input);

  const result = await routeAI(systemPrompt, userPrompt);

  if (!result.ok) {
    return {
      ok: false,
      agent: agent.name,
      provider: result.provider,
      rawText: result.rawText,
      error: result.error,
    };
  }

  let parsed: unknown;
  if (agent.output_format === "strict_json") {
    parsed = safeParseJSON(result.rawText) ?? undefined;
  }

  return {
    ok: true,
    agent: agent.name,
    provider: result.provider,
    rawText: result.rawText,
    parsed,
  };
}
