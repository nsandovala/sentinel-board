/**
 * AI provider router: Ollama → OpenRouter → heuristic fallback.
 *
 * Each provider follows the OpenAI-compatible chat completions format,
 * so the same message payload works across all three.
 */

export type AIProviderName = "ollama" | "openrouter" | "heuristic";

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
