"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { SentinelCard, ChecklistItemStatus } from "@/types/card";
import { cn } from "@/lib/utils";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";

const priorityConfig: Record<string, { classes: string; label: string }> = {
  low: { classes: "border border-border/50 bg-muted/90 text-muted-foreground", label: "Low" },
  medium: { classes: "border border-border/55 bg-muted text-foreground/75", label: "Med" },
  high: {
    classes:
      "border border-[oklch(0.42_0.012_285/0.45)] bg-[oklch(0.2_0.008_285)] text-foreground/88",
    label: "High",
  },
  critical: { classes: "border border-red-900/55 bg-red-950/45 text-red-200/85", label: "Crit" },
};

const statusDot: Record<ChecklistItemStatus, string> = {
  pending: "bg-foreground/22",
  in_progress: "bg-foreground/32",
  review: "bg-foreground/42",
  blocked: "bg-red-700/85",
  done: "bg-foreground/55",
};

interface CardItemProps {
  card: SentinelCard;
  overlay?: boolean;
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleDateString("es-MX", { month: "short" });
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${day} ${month} · ${hh}:${mm}`;
  } catch {
    return "";
  }
}

function ChecklistSummary({ card }: { card: SentinelCard }) {
  if (card.checklist.length === 0) return null;

  const total = card.checklist.length;
  const doneCount = card.checklist.filter((i) => i.status === "done").length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {card.checklist.map((item) => (
          <span
            key={item.id}
            className={cn("h-1.5 w-1.5 rounded-full", statusDot[item.status])}
            title={`${item.text} — ${item.status}`}
          />
        ))}
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">
        {doneCount}/{total}
      </span>
    </div>
  );
}

function CardContent({ card, isSelected, priority }: {
  card: SentinelCard;
  isSelected: boolean;
  priority: { classes: string; label: string };
}) {
  return (
    <>
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[2px] rounded-l-[0.42rem] transition-colors",
          isSelected
            ? "sentinel-card-accent-selected"
            : "bg-transparent group-hover:bg-[oklch(0.62_0.02_285/0.11)]",
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="sentinel-card-title min-w-0 flex-1">{card.title}</span>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wider",
            priority.classes,
          )}
        >
          {priority.label}
        </span>
      </div>

      {card.description && (
        <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
          {card.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-0">
        <div className="flex items-center gap-1.5">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-border/30 bg-muted/70 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-muted-foreground"
            >
              {tag}
            </span>
          ))}
          {card.createdAt && (
            <span className="text-[9px] tabular-nums text-muted-foreground/45">
              {formatShortDate(card.createdAt)}
            </span>
          )}
        </div>
        <ChecklistSummary card={card} />
      </div>
    </>
  );
}

export function CardItemOverlay({ card }: { card: SentinelCard }) {
  const priority = priorityConfig[card.priority] ?? priorityConfig.medium;
  return (
    <div
      className={cn(
        "sentinel-board-card sentinel-board-ticket group relative flex w-72 cursor-grabbing flex-col gap-1.5 border p-2.5 pl-3 opacity-90 shadow-xl ring-1 ring-primary/20",
      )}
    >
      <CardContent card={card} isSelected={false} priority={priority} />
    </div>
  );
}

export function CardItem({ card }: CardItemProps) {
  const { selectedCardId } = useSentinel();
  const dispatch = useSentinelDispatch();
  const priority = priorityConfig[card.priority] ?? priorityConfig.medium;
  const isSelected = selectedCardId === card.id;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const handleClick = () => {
    if (!isDragging) {
      dispatch({ type: "SELECT_CARD", cardId: isSelected ? null : card.id });
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2500);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${card.id}`, { method: "DELETE" });
      if (res.ok) {
        dispatch({ type: "DELETE_CARD", cardId: card.id });
      }
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dispatch({ type: "SELECT_CARD", cardId: isSelected ? null : card.id });
        }
      }}
      className={cn(
        "sentinel-board-card sentinel-board-ticket group relative flex cursor-grab flex-col gap-1.5 border p-2.5 pl-3",
        "transition-[background-color,border-color,box-shadow] duration-200 ease-out outline-none",
        isSelected && "sentinel-card-iridescent",
        isDragging && "opacity-30",
      )}
    >
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        title={confirmDelete ? "Click de nuevo para confirmar" : "Eliminar tarea"}
        className={cn(
          "absolute right-1.5 top-1.5 z-10 rounded p-1 transition-all",
          "opacity-0 group-hover:opacity-100 focus:opacity-100",
          confirmDelete
            ? "bg-red-500/90 text-white hover:bg-red-600"
            : "bg-muted/80 text-muted-foreground hover:bg-destructive/20 hover:text-destructive",
          deleting && "pointer-events-none opacity-50",
        )}
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <CardContent card={card} isSelected={isSelected} priority={priority} />
    </div>
  );
}
