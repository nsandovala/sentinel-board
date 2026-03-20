import type {
  AIProvider,
  AICapability,
  AICompletionRequest,
  AICompletionResponse,
  AIRouterConfig,
} from "./ai-types";
import { DEFAULT_ROUTER_CONFIG } from "./ai-types";
import { MockAIProvider } from "./ai-provider";
import { createOllamaProvider } from "./providers/ollama-provider";
import { createLMStudioProvider } from "./providers/lmstudio-provider";

function buildProviders(config: AIRouterConfig): AIProvider[] {
  const providers: AIProvider[] = [];

  for (const pc of config.providers) {
    if (!pc.enabled) continue;
    switch (pc.type) {
      case "ollama":
        providers.push(createOllamaProvider(pc));
        break;
      case "lmstudio":
        providers.push(createLMStudioProvider(pc));
        break;
    }
  }

  if (config.fallbackToMock) {
    providers.push(new MockAIProvider());
  }

  return providers;
}

export class AIRouter {
  private providers: AIProvider[];

  constructor(config: AIRouterConfig = DEFAULT_ROUTER_CONFIG) {
    this.providers = buildProviders(config);
  }

  /**
   * Try each enabled provider in order. First available one handles
   * the request. If all real providers fail, falls back to mock
   * (which returns a JSON flag so callers can detect the fallback).
   */
  async complete(
    request: AICompletionRequest,
    _capability?: AICapability,
  ): Promise<AICompletionResponse> {
    for (const provider of this.providers) {
      try {
        const available = await provider.isAvailable();
        if (!available) continue;
        return await provider.complete(request);
      } catch {
        continue;
      }
    }

    const mock = new MockAIProvider();
    return mock.complete(request);
  }

  async getFirstAvailable(): Promise<AIProvider | null> {
    for (const provider of this.providers) {
      if (provider.type === "mock") continue;
      const ok = await provider.isAvailable();
      if (ok) return provider;
    }
    return null;
  }

  listProviders(): { type: string; enabled: boolean }[] {
    return this.providers.map((p) => ({
      type: p.type,
      enabled: p.config.enabled,
    }));
  }
}

let _defaultRouter: AIRouter | null = null;

export function getAIRouter(): AIRouter {
  if (!_defaultRouter) {
    _defaultRouter = new AIRouter();
  }
  return _defaultRouter;
}
