import type { AgentRisk, CardAgentMetadata, MoneyCodeData, SentinelCard } from "@/types/card";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBulletList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  if (typeof value === "string") {
    return Array.from(new Set(parseBulletList(value)));
  }

  return [];
}

function normalizeRisk(value: unknown): AgentRisk | null {
  if (typeof value === "string") {
    const label = value.trim();
    return label ? { label, status: "open" } : null;
  }

  const record = asRecord(value);
  if (!record) return null;

  const label =
    cleanText(record.label) ??
    cleanText(record.title) ??
    cleanText(record.risk) ??
    cleanText(record.description);

  if (!label) return null;

  const mitigation =
    cleanText(record.mitigation) ??
    cleanText(record.mitigacion) ??
    cleanText(record.resolution) ??
    cleanText(record.plan);

  const rawStatus = cleanText(record.status)?.toLowerCase();
  const status =
    rawStatus === "mitigated" || rawStatus === "watch" || rawStatus === "open"
      ? rawStatus
      : mitigation
        ? "mitigated"
        : "open";

  return { label, mitigation, status };
}

function normalizeRisks(value: unknown): AgentRisk[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const risks: AgentRisk[] = [];

  for (const item of value) {
    const risk = normalizeRisk(item);
    if (!risk) continue;

    const key = risk.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    risks.push(risk);
  }

  return risks;
}

function resolveTagValue(tags: string[], prefix: string): string | undefined {
  const hit = tags.find((tag) => tag.toLowerCase().startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || undefined : undefined;
}

export function extractCardMetadata(
  card: Pick<SentinelCard, "tags" | "metadata" | "codexLoop" | "fiveWhys" | "moneyCode">,
): CardAgentMetadata {
  const codexLoop = asRecord(card.codexLoop) ?? {};
  const fiveWhys = asRecord(card.fiveWhys) ?? {};
  const moneyCode = asRecord(card.moneyCode as MoneyCodeData | undefined) ?? {};
  const existing = card.metadata;
  const tags = card.tags ?? [];

  const plan = Array.from(
    new Set([
      ...normalizeList(existing?.plan),
      ...normalizeList(codexLoop.plan),
      ...normalizeList(codexLoop.solution),
    ]),
  );

  const validations = Array.from(
    new Set([
      ...normalizeList(existing?.validations),
      ...normalizeList(codexLoop.validations),
      ...normalizeList(codexLoop.validation),
    ]),
  );

  const done_when = Array.from(
    new Set([
      ...normalizeList(existing?.done_when),
      ...normalizeList(codexLoop.done_when),
      ...normalizeList(codexLoop.nextStep),
    ]),
  );

  const files_to_touch = Array.from(
    new Set([
      ...normalizeList(existing?.files_to_touch),
      ...normalizeList(codexLoop.files_to_touch),
      ...normalizeList(fiveWhys.files_to_touch),
    ]),
  );

  const risks = [
    ...normalizeRisks(existing?.risks),
    ...normalizeRisks(codexLoop.risks),
    ...normalizeRisks(fiveWhys.risks),
  ].filter((risk, index, list) => {
    const key = risk.label.toLowerCase();
    return list.findIndex((candidate) => candidate.label.toLowerCase() === key) === index;
  });

  const score =
    existing?.score ??
    (typeof moneyCode.score === "number" ? moneyCode.score : undefined);

  return {
    plan,
    risks,
    validations,
    done_when,
    files_to_touch,
    state_guardian:
      existing?.state_guardian ??
      cleanText(codexLoop.state_guardian) ??
      cleanText(fiveWhys.state_guardian),
    qa_review:
      existing?.qa_review ??
      cleanText(codexLoop.qa_review) ??
      cleanText(fiveWhys.qa_review),
    scoring_detail:
      existing?.scoring_detail ??
      cleanText(codexLoop.scoring_detail) ??
      cleanText(fiveWhys.scoring_detail) ??
      cleanText(moneyCode.rationale),
    score,
    source: existing?.source ?? (tags.includes("amon-agents") ? "amon-agents" : undefined),
    agent: existing?.agent ?? resolveTagValue(tags, "agent:"),
    externalTaskId: existing?.externalTaskId ?? resolveTagValue(tags, "ext:"),
  };
}

export function hasUnmitigatedRisks(metadata: CardAgentMetadata): boolean {
  return metadata.risks.some((risk) => !risk.mitigation && risk.status !== "mitigated");
}
