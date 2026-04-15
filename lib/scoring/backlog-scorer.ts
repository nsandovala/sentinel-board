import type { SentinelCard } from "@/types/card";

// ── Config ──────────────────────────────────────────────────────────────────

const MAX_AGE_DAYS = 90;
const AGE_WEIGHT = 0.35;
const ACTIVE_PROJECT_WEIGHT = 0.4;
const URGENCY_WEIGHT = 0.25;

const URGENCY_TAGS = new Set([
  "urgente",
  "urgent",
  "hot",
  "critical",
  "fire",
  "produccion",
  "producción",
]);

// ── Types ───────────────────────────────────────────────────────────────────

export interface BacklogScore {
  cardId: string;
  score: number;        // 0-100
  ageScore: number;     // 0-100 contribution from age
  projectScore: number; // 0-100 contribution from active project
  urgencyScore: number; // 0-100 contribution from urgency tags
}

// ── Scoring Logic ───────────────────────────────────────────────────────────

/**
 * Score a single backlog card.
 *
 * Formula (0-100):
 *   score = ageScore * 0.35 + projectScore * 0.40 + urgencyScore * 0.25
 *
 * - ageScore: 0 if just created → 100 if >= MAX_AGE_DAYS old (linear)
 * - projectScore: 100 if the card's project has cards "en_proceso" or beyond,
 *                 0 otherwise (we want to surface ideas from active projects)
 * - urgencyScore: 100 if card has urgency tags or is blocked,
 *                 50 if priority is high/critical, 0 otherwise
 */
export function scoreBacklogCard(
  card: SentinelCard,
  allCards: SentinelCard[],
  now: Date = new Date(),
): BacklogScore {
  // ── Age score: linear 0→100 over MAX_AGE_DAYS ──
  const createdAt = card.createdAt ? new Date(card.createdAt) : now;
  const ageDays = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const ageScore = Math.min(100, Math.round((ageDays / MAX_AGE_DAYS) * 100));

  // ── Active project score: does this card's project have cards in progress? ──
  const projectCards = allCards.filter((c) => c.projectId === card.projectId);
  const activeStatuses = new Set([
    "en_proceso",
    "desarrollo",
    "qa",
  ]);
  const hasActiveWork = projectCards.some((c) => activeStatuses.has(c.status));
  const projectScore = hasActiveWork ? 100 : 0;

  // ── Urgency score: tags + blocked status + priority ──
  const hasUrgencyTag = card.tags.some((t) => URGENCY_TAGS.has(t.toLowerCase()));
  const isBlocked = card.blocked === true;
  const isHighPriority =
    card.priority === "high" || card.priority === "critical";

  let urgencyScore = 0;
  if (hasUrgencyTag || isBlocked) {
    urgencyScore = 100;
  } else if (isHighPriority) {
    urgencyScore = 50;
  }

  // ── Weighted total ──
  const score = Math.round(
    ageScore * AGE_WEIGHT + projectScore * ACTIVE_PROJECT_WEIGHT + urgencyScore * URGENCY_WEIGHT,
  );

  return {
    cardId: card.id,
    score,
    ageScore,
    projectScore,
    urgencyScore,
  };
}

/**
 * Score and sort a list of backlog cards (descending by score).
 * Cards not in backlog (already in progress or done) are filtered out.
 */
export function scoreAndSortBacklog(
  cards: SentinelCard[],
  now?: Date,
): { card: SentinelCard; score: BacklogScore }[] {
  const backlog = cards.filter(
    (c) => c.status === "idea_bruta" || c.blocked,
  );

  const scored = backlog.map((card) => ({
    card,
    score: scoreBacklogCard(card, cards, now),
  }));

  scored.sort((a, b) => b.score.score - a.score.score);
  return scored;
}

/**
 * Check if any backlog card has a score above the threshold (default 70).
 * Used for sidebar badge.
 */
export function hasHighPriorityBacklogItems(
  cards: SentinelCard[],
  threshold = 70,
  now?: Date,
): boolean {
  const scored = scoreAndSortBacklog(cards, now);
  return scored.some((s) => s.score.score >= threshold);
}

/**
 * Get count of high-priority backlog items (for badge number).
 */
export function highPriorityBacklogCount(
  cards: SentinelCard[],
  threshold = 70,
  now?: Date,
): number {
  const scored = scoreAndSortBacklog(cards, now);
  return scored.filter((s) => s.score.score >= threshold).length;
}
