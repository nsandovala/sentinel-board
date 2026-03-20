import type {
  AIProvider,
  AIProviderConfig,
  AIProviderType,
  AICompletionRequest,
  AICompletionResponse,
} from "./ai-types";

/**
 * Mock provider — always available, returns empty JSON so the caller
 * falls back to existing heuristic logic.  This keeps the system
 * fully functional without any AI server running.
 */
export class MockAIProvider implements AIProvider {
  readonly type: AIProviderType = "mock";
  readonly config: AIProviderConfig = {
    type: "mock",
    baseUrl: "",
    model: "mock",
    enabled: true,
  };

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
    return {
      content: JSON.stringify({ fallback: true, input: lastUser?.content ?? "" }),
      model: "mock",
      provider: "mock",
      durationMs: 0,
    };
  }
}

/**
 * Base class for HTTP-based local AI providers (Ollama, LM Studio).
 * Subclasses implement `buildRequestBody` and `extractContent` to
 * handle provider-specific API shapes.
 */
export abstract class BaseLocalAIProvider implements AIProvider {
  abstract readonly type: AIProviderType;

  constructor(readonly config: AIProviderConfig) {}

  async isAvailable(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), this.config.timeoutMs ?? 3000);
      const res = await fetch(this.healthUrl(), { signal: ctrl.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const start = performance.now();
    const body = this.buildRequestBody(request);

    const res = await fetch(this.completionUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
    });

    if (!res.ok) {
      throw new Error(`[${this.type}] HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const content = this.extractContent(json);
    const durationMs = Math.round(performance.now() - start);

    return {
      content,
      model: this.config.model,
      provider: this.type,
      durationMs,
    };
  }

  protected abstract healthUrl(): string;
  protected abstract completionUrl(): string;
  protected abstract buildRequestBody(request: AICompletionRequest): unknown;
  protected abstract extractContent(json: unknown): string;
}
