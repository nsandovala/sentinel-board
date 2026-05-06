import { deriveCodexLoop } from "@/lib/analysis/codex-loop";
import type { CodexLoopData, SentinelCard } from "@/types/card";

export function generateCodexLoop(card: SentinelCard): CodexLoopData {
  return deriveCodexLoop(card);
}
