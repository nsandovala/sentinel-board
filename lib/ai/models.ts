/**
 * Source of truth for model identifiers per provider.
 *
 * Two layers of validation:
 *   1. An explicit allowlist (`ANTHROPIC_MODELS`) — canonical model IDs we
 *      know exist on the provider. New users editing `.env` will be guided
 *      here. Updating this file is the place to add a freshly released model.
 *   2. A format regex (`ANTHROPIC_MODEL_PATTERN`) — accepts model IDs that
 *      *look like* legitimate Claude versions (e.g. dated snapshots we have
 *      not added yet, or experimental aliases) without forcing a code change
 *      on every model release. Anything outside both checks is rejected.
 *
 * OpenRouter and Ollama do not get a hard allowlist:
 *   - OpenRouter routes hundreds of vendor/model pairs that change weekly.
 *     We only enforce the `<vendor>/<model>` shape.
 *   - Ollama and LM Studio names depend on what the user pulled locally; we
 *     only enforce a reasonable charset.
 *
 * This module has zero runtime dependencies so it can be imported from
 * server routes and validation helpers without dragging the AI router.
 */

export type ProviderName = "anthropic" | "openrouter" | "ollama" | "lmstudio";

// ── Anthropic ──────────────────────────────────────────────────────────────
// Canonical, currently-supported model IDs.
// Update this list when Anthropic publishes a new family/snapshot.
export const ANTHROPIC_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
] as const;

export type AnthropicModel = (typeof ANTHROPIC_MODELS)[number];

// Conservative regex for dated snapshots / variants we may not have listed
// explicitly yet (e.g. `claude-sonnet-4-6-20260112`). Refuses obviously legacy
// names like `claude-2.1` and anything not starting with `claude-`.
const ANTHROPIC_MODEL_PATTERN =
  /^claude-(opus|sonnet|haiku)-\d+(?:[-.]\d+)*(?:-\d{8})?$/;

export function isValidAnthropicModel(model: string | undefined | null): boolean {
  if (!model) return false;
  if ((ANTHROPIC_MODELS as readonly string[]).includes(model)) return true;
  return ANTHROPIC_MODEL_PATTERN.test(model);
}

// ── OpenRouter ─────────────────────────────────────────────────────────────
// OpenRouter expects `vendor/model[:variant]`. Common examples:
//   openai/gpt-4o-mini
//   anthropic/claude-3.5-sonnet
//   qwen/qwen3-8b:free
const OPENROUTER_MODEL_PATTERN = /^[a-z0-9._-]+\/[a-z0-9._:-]+$/i;

export function isValidOpenRouterModel(model: string | undefined | null): boolean {
  if (!model) return false;
  if (model.length > 200) return false;
  return OPENROUTER_MODEL_PATTERN.test(model);
}

// ── Ollama / LM Studio ─────────────────────────────────────────────────────
// User-controlled local pulls. Just guard against empty / shell-injectable junk.
const LOCAL_MODEL_PATTERN = /^[a-z0-9._:/-]+$/i;

export function isValidLocalModel(model: string | undefined | null): boolean {
  if (!model) return false;
  if (model.length > 200) return false;
  return LOCAL_MODEL_PATTERN.test(model);
}

export const isValidOllamaModel = isValidLocalModel;
export const isValidLmStudioModel = isValidLocalModel;

// ── Single validator entrypoint ────────────────────────────────────────────
export interface ModelValidation {
  valid: boolean;
  model: string;
  reason?: string;
}

export function validateModel(
  provider: ProviderName,
  model: string | undefined | null,
): ModelValidation {
  const value = (model ?? "").trim();
  if (!value) {
    return { valid: false, model: value, reason: `${provider}: model is empty` };
  }

  switch (provider) {
    case "anthropic":
      return isValidAnthropicModel(value)
        ? { valid: true, model: value }
        : {
            valid: false,
            model: value,
            reason: `anthropic: "${value}" is not a recognised Claude model id`,
          };
    case "openrouter":
      return isValidOpenRouterModel(value)
        ? { valid: true, model: value }
        : {
            valid: false,
            model: value,
            reason: `openrouter: "${value}" does not match vendor/model format`,
          };
    case "ollama":
    case "lmstudio":
      return isValidLocalModel(value)
        ? { valid: true, model: value }
        : {
            valid: false,
            model: value,
            reason: `${provider}: "${value}" contains invalid characters`,
          };
  }
}
