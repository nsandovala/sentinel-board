export type AgentMode = "advisory" | "execute";

export type AgentDefinition = {
  name: string;
  label: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  mode: AgentMode;
  rules?: string[];
  output_format?: "strict_json" | "text";
  contract?: {
    type: string;
    required?: string[];
  };
};

export type AgentRunInput = Record<string, unknown>;

export type BuiltAgentPrompt = {
  systemPrompt: string;
  userPrompt: string;
};

export type AgentRunResult = {
  ok: boolean;
  agent: string;
  provider: string;
  rawText: string;
  parsed?: unknown;
  error?: string;
};