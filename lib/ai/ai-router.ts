/**
 * AI provider router: Ollama → OpenRouter → Anthropic → heuristic fallback.
 *
 * Each provider follows its native API format.
 * Ollama/OpenRouter use OpenAI-compatible chat completions.
 * Anthropic uses its Messages API.
 */

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
  available: () => boolean;
  call: (messages: ChatMessage[]) => Promise<AIRouterResult>;
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

async function callOllama(messages: ChatMessage[]): Promise<AIRouterResult> {
  const base = getEnv("OLLAMA_BASE_URL", "http://localhost:11434");
  const model = getEnv("OLLAMA_MODEL", "qwen3:8b");

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

async function callOpenRouter(messages: ChatMessage[]): Promise<AIRouterResult> {
  const key = getEnv("OPENROUTER_API_KEY", "");
  const model = getEnv("OPENROUTER_MODEL", "qwen/qwen3-8b:free");

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

async function callAnthropic(messages: ChatMessage[]): Promise<AIRouterResult> {
  const key = getEnv("ANTHROPIC_API_KEY", "");
  const model = getEnv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001");

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

const providers: ProviderConfig[] = [
  {
    name: "ollama",
    available: () => true,
    call: callOllama,
  },
  {
    name: "openrouter",
    available: () => getEnv("OPENROUTER_API_KEY", "").length > 0,
    call: callOpenRouter,
  },
  {
    name: "anthropic",
    available: () => getEnv("ANTHROPIC_API_KEY", "").length > 0,
    call: callAnthropic,
  },
];

/**
 * Routes a chat completion through available providers in priority order.
 * Returns the first successful result, or an error from the last attempt
 * so the caller knows to activate heuristic fallback.
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

  for (const p of providers) {
    if (!p.available()) continue;

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
    error: "Sin proveedores disponibles",
  };
}
