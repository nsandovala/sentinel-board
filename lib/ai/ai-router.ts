/**
 * AI provider router: Ollama → OpenRouter → Anthropic → heuristic fallback.
 *
 * Each provider follows its native API format.
 * Ollama/OpenRouter use OpenAI-compatible chat completions.
 * Anthropic uses its Messages API.
 *
 * Model identifiers are validated against `lib/ai/models.ts` BEFORE any HTTP
 * call. An invalid model never reaches the network — the provider is skipped
 * with a clear error and a single console warning so misconfiguration shows
 * up loudly instead of silently.
 */

import { validateModel, type ProviderName } from "./models";

export type AIProviderName = "ollama" | "openrouter" | "anthropic" | "heuristic";

export interface AIRouterResult {
  ok: boolean;
  provider: AIProviderName;
  rawText: string;
  error?: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ProviderConfig {
  name: AIProviderName;
  /** True only if env is set AND the configured model id is valid. */
  available: () => boolean;
  /** Status snapshot used by describeProviders() for diagnostics. */
  describe: () => ProviderStatus;
  call: (messages: ChatMessage[]) => Promise<AIRouterResult>;
}

export interface ProviderStatus {
  provider: AIProviderName;
  configured: boolean;
  model: string;
  modelValid: boolean;
  modelError?: string;
  available: boolean;
}

function getEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function extractContent(json: Record<string, unknown>): string {
  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  if (choices?.[0]?.message?.content) return choices[0].message.content;

  const msg = json.message as { content?: string } | undefined;
  if (msg?.content) return msg.content;

  return "";
}

// One warning per (provider, model) per process — avoids log spam when the
// router is called on every dock submit.
const warnedKeys = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[ai-router] ${message}`);
}

function rejectInvalidModel(
  provider: AIProviderName,
  reason: string,
): AIRouterResult {
  return {
    ok: false,
    provider,
    rawText: "",
    error: `Invalid ${provider} model configured: ${reason}`,
  };
}

// ── Ollama ─────────────────────────────────────────────────────────────────
const OLLAMA_DEFAULT_MODEL = "qwen3:8b";

function ollamaModel(): string {
  return getEnv("OLLAMA_MODEL", OLLAMA_DEFAULT_MODEL);
}

async function callOllama(messages: ChatMessage[]): Promise<AIRouterResult> {
  const base = getEnv("OLLAMA_BASE_URL", "http://localhost:11434");
  const model = ollamaModel();

  const check = validateModel("ollama", model);
  if (!check.valid) {
    warnOnce(`ollama:${model}`, check.reason ?? "invalid Ollama model");
    return rejectInvalidModel("ollama", check.reason ?? "invalid model");
  }

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, provider: "ollama", rawText: body, error: `Ollama ${res.status}` };
  }

  const json = await res.json();
  const rawText = extractContent(json);

  if (!rawText) {
    return { ok: false, provider: "ollama", rawText: "", error: "Ollama: respuesta vacia" };
  }

  return { ok: true, provider: "ollama", rawText };
}

// ── OpenRouter ─────────────────────────────────────────────────────────────
const OPENROUTER_DEFAULT_MODEL = "qwen/qwen3-8b:free";

function openRouterModel(): string {
  return getEnv("OPENROUTER_MODEL", OPENROUTER_DEFAULT_MODEL);
}

async function callOpenRouter(messages: ChatMessage[]): Promise<AIRouterResult> {
  const key = getEnv("OPENROUTER_API_KEY", "");
  const model = openRouterModel();

  const check = validateModel("openrouter", model);
  if (!check.valid) {
    warnOnce(`openrouter:${model}`, check.reason ?? "invalid OpenRouter model");
    return rejectInvalidModel("openrouter", check.reason ?? "invalid model");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Title": "sentinel-board",
    },
    body: JSON.stringify({ model, messages, temperature: 0.3 }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      provider: "openrouter",
      rawText: body,
      error: `OpenRouter ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  const json = await res.json();
  const rawText = extractContent(json);

  if (!rawText) {
    return { ok: false, provider: "openrouter", rawText: "", error: "OpenRouter: respuesta vacia" };
  }

  return { ok: true, provider: "openrouter", rawText };
}

// ── Anthropic ──────────────────────────────────────────────────────────────
const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function anthropicModel(): string {
  return getEnv("ANTHROPIC_MODEL", ANTHROPIC_DEFAULT_MODEL);
}

async function callAnthropic(messages: ChatMessage[]): Promise<AIRouterResult> {
  const key = getEnv("ANTHROPIC_API_KEY", "");
  const model = anthropicModel();

  const check = validateModel("anthropic", model);
  if (!check.valid) {
    warnOnce(`anthropic:${model}`, check.reason ?? "invalid Anthropic model");
    return rejectInvalidModel("anthropic", check.reason ?? "invalid model");
  }

  const systemMessage = messages.find((m) => m.role === "system");
  const userMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemMessage?.content ?? "",
      messages: userMessages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      provider: "anthropic",
      rawText: body,
      error: `Anthropic ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  const json = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const textBlock = json.content?.find((c) => c.type === "text");
  const rawText = textBlock?.text ?? "";

  if (!rawText) {
    return { ok: false, provider: "anthropic", rawText: "", error: "Anthropic: respuesta vacia" };
  }

  return { ok: true, provider: "anthropic", rawText };
}

// ── Provider registry ──────────────────────────────────────────────────────
function describeProvider(
  name: AIProviderName,
  envKey: string | null,
  providerKey: ProviderName,
  model: string,
): ProviderStatus {
  const configured = envKey === null ? true : getEnv(envKey, "").trim().length > 0;
  const check = validateModel(providerKey, model);
  return {
    provider: name,
    configured,
    model,
    modelValid: check.valid,
    modelError: check.reason,
    available: configured && check.valid,
  };
}

const providers: ProviderConfig[] = [
  {
    name: "ollama",
    available: () => describeProvider("ollama", null, "ollama", ollamaModel()).available,
    describe: () => describeProvider("ollama", null, "ollama", ollamaModel()),
    call: callOllama,
  },
  {
    name: "openrouter",
    available: () =>
      describeProvider("openrouter", "OPENROUTER_API_KEY", "openrouter", openRouterModel())
        .available,
    describe: () =>
      describeProvider("openrouter", "OPENROUTER_API_KEY", "openrouter", openRouterModel()),
    call: callOpenRouter,
  },
  {
    name: "anthropic",
    available: () =>
      describeProvider("anthropic", "ANTHROPIC_API_KEY", "anthropic", anthropicModel())
        .available,
    describe: () =>
      describeProvider("anthropic", "ANTHROPIC_API_KEY", "anthropic", anthropicModel()),
    call: callAnthropic,
  },
];

/**
 * Snapshot of every provider's effective state — used by future doctor /
 * status endpoints and by `routeAI` itself to skip misconfigured providers.
 *
 * Each entry carries:
 *   - `configured`: required env vars are present
 *   - `modelValid`: configured model id passes lib/ai/models.ts validation
 *   - `available`: both of the above (healthy enough to attempt a call)
 *   - `modelError`: human-readable reason when modelValid is false
 */
export function describeProviders(): ProviderStatus[] {
  return providers.map((p) => p.describe());
}

/**
 * Routes a chat completion through available providers in priority order.
 * Skips providers whose env/model is invalid (a warning is logged once per
 * process for the offending model). Returns the first successful result,
 * or the last attempt's error so the caller can switch to heuristic fallback.
 */
export async function routeAI(
  systemPrompt: string,
  userPrompt: string,
): Promise<AIRouterResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let lastError: AIRouterResult | null = null;
  let skippedInvalid = false;

  for (const p of providers) {
    const status = p.describe();
    if (!status.configured) continue;
    if (!status.modelValid) {
      warnOnce(`skip:${status.provider}:${status.model}`,
        `skipping ${status.provider} due to invalid model "${status.model}"`,
      );
      skippedInvalid = true;
      lastError = {
        ok: false,
        provider: status.provider,
        rawText: "",
        error: status.modelError ?? `Invalid ${status.provider} model`,
      };
      continue;
    }

    try {
      const result = await p.call(messages);
      if (result.ok) return result;
      lastError = result;
    } catch (err) {
      lastError = {
        ok: false,
        provider: p.name,
        rawText: "",
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  }

  return lastError ?? {
    ok: false,
    provider: "heuristic",
    rawText: "",
    error: skippedInvalid
      ? "Todos los proveedores configurados tienen modelo inválido"
      : "Sin proveedores disponibles",
  };
}
