import { BaseLocalAIProvider } from "../ai-provider";
import type {
  AIProviderConfig,
  AIProviderType,
  AICompletionRequest,
} from "../ai-types";

/**
 * Ollama provider — speaks the /api/chat endpoint.
 * https://github.com/ollama/ollama/blob/main/docs/api.md
 */
export class OllamaProvider extends BaseLocalAIProvider {
  readonly type: AIProviderType = "ollama";

  protected healthUrl(): string {
    return `${this.config.baseUrl}/api/tags`;
  }

  protected completionUrl(): string {
    return `${this.config.baseUrl}/api/chat`;
  }

  protected buildRequestBody(request: AICompletionRequest): unknown {
    return {
      model: this.config.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        temperature: request.temperature ?? 0.3,
        num_predict: request.maxTokens ?? 512,
      },
    };
  }

  protected extractContent(json: unknown): string {
    const data = json as { message?: { content?: string } };
    return data.message?.content ?? "";
  }
}

export function createOllamaProvider(config: AIProviderConfig): OllamaProvider {
  return new OllamaProvider(config);
}
