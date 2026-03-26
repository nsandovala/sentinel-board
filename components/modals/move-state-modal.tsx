"use client";

import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BOARD_STATUS_OPTIONS } from "@/lib/console/status-labels";
import type { CardStatus } from "@/types/enums";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";

interface MoveStateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MoveStateModal({ open, onOpenChange }: MoveStateModalProps) {
  const { cards, selectedCardId } = useSentinel();
  const dispatch = useSentinelDispatch();
  const [cardId, setCardId] = useState<string>("");
  const [status, setStatus] = useState<CardStatus>("en_proceso");

  useEffect(() => {
    if (!open) return;
    const preferred =
      (selectedCardId && cards.some((c) => c.id === selectedCardId) ? selectedCardId : null) ??
      cards[0]?.id ??
      "";
    setCardId(preferred);
    const current = cards.find((c) => c.id === preferred);
    if (current) setStatus(current.status);
  }, [open, selectedCardId, cards]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!cardId) return;
      dispatch({ type: "MOVE_CARD", cardId, status });
      dispatch({ type: "SET_VIEW", view: "board" });
      dispatch({ type: "SELECT_CARD", cardId });
      onOpenChange(false);
    },
    [cardId, status, dispatch, onOpenChange],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-state-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="move-state-title" className="text-sm font-semibold text-foreground">
            Mover estado
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="mv-card" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Tarjeta
            </label>
            <select
              id="mv-card"
              value={cardId}
              onChange={(e) => {
                const id = e.target.value;
                setCardId(id);
                const c = cards.find((x) => x.id === id);
                if (c) setStatus(c.status);
              }}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-input/30"
            >
              {cards.length === 0 && <option value="">Sin tarjetas</option>}
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mv-status" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Nuevo estado
            </label>
            <select
              id="mv-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as CardStatus)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring dark:bg-input/30"
            >
              {BOARD_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!cardId}>
              Mover y ver board
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
