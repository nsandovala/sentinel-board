import { BaseLocalAIProvider } from "../ai-provider";
import type {
  AIProviderConfig,
  AIProviderType,
  AICompletionRequest,
} from "../ai-types";

/**
 * LM Studio provider — speaks the OpenAI-compatible /v1/chat/completions endpoint.
 * https://lmstudio.ai/docs/api
 */
export class LMStudioProvider extends BaseLocalAIProvider {
  readonly type: AIProviderType = "lmstudio";

  protected healthUrl(): string {
    return `${this.config.baseUrl}/v1/models`;
  }

  protected completionUrl(): string {
    return `${this.config.baseUrl}/v1/chat/completions`;
  }

  protected buildRequestBody(request: AICompletionRequest): unknown {
    return {
      model: this.config.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 512,
      stream: false,
    };
  }

  protected extractContent(json: unknown): string {
    const data = json as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}

export function createLMStudioProvider(config: AIProviderConfig): LMStudioProvider {
  return new LMStudioProvider(config);
}
