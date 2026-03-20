export type AIProviderType = "ollama" | "lmstudio" | "mock";

export type AICapability =
  | "parse_command"
  | "codex_loop"
  | "money_code"
  | "suggestions";

export interface AIProviderConfig {
  type: AIProviderType;
  baseUrl: string;
  model: string;
  enabled: boolean;
  timeoutMs?: number;
}

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  provider: AIProviderType;
  durationMs: number;
}

export interface AIProvider {
  readonly type: AIProviderType;
  readonly config: AIProviderConfig;

  isAvailable(): Promise<boolean>;
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
}

export interface AIRouterConfig {
  providers: AIProviderConfig[];
  fallbackToMock: boolean;
}

export const DEFAULT_OLLAMA_CONFIG: AIProviderConfig = {
  type: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3.2",
  enabled: false,
};

export const DEFAULT_LMSTUDIO_CONFIG: AIProviderConfig = {
  type: "lmstudio",
  baseUrl: "http://localhost:1234",
  model: "default",
  enabled: false,
};

export const DEFAULT_ROUTER_CONFIG: AIRouterConfig = {
  providers: [DEFAULT_OLLAMA_CONFIG, DEFAULT_LMSTUDIO_CONFIG],
  fallbackToMock: true,
};
