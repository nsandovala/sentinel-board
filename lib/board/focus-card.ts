"use client";

/**
 * Reusable card-focus helper for the Sentinel board.
 *
 * Usage:
 *   focusCardById("task-123")
 *
 * Behaviour:
 *   1. Writes `?card=<id>` to the URL via history.replaceState (no route reload).
 *   2. Broadcasts a `sentinel:focus-card` CustomEvent on `window`.
 *
 * Listeners:
 *   - SentinelProvider:   dispatches SELECT_CARD + SET_VIEW("board")
 *   - CardItem (matching id): scrolls into view + applies temporary highlight
 *
 * Safe to call from any module (backlog, timeline, suggested actions,
 * terminal). Fails silently if the card id is missing or if the DOM is not
 * available (SSR). If the card is not currently rendered the scroll/highlight
 * is a no-op, but the URL still updates so a refresh keeps the deep link.
 */

export const FOCUS_CARD_EVENT = "sentinel:focus-card";

export interface FocusCardDetail {
  cardId: string;
}

export function focusCardById(cardId: string): void {
  if (!cardId || typeof window === "undefined") return;

  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("card") !== cardId) {
      url.searchParams.set("card", cardId);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  } catch {
    // URL manipulation should never throw, but ignore if it does.
  }

  window.dispatchEvent(
    new CustomEvent<FocusCardDetail>(FOCUS_CARD_EVENT, {
      detail: { cardId },
    }),
  );
}

export function clearFocusedCardParam(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("card")) {
      url.searchParams.delete("card");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  } catch {
    // ignore
  }
}
