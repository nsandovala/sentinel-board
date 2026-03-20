"use client";

import { SentinelCard, ChecklistItemStatus } from "@/types/card";
import { cn } from "@/lib/utils";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";

const priorityConfig: Record<string, { classes: string; label: string }> = {
  low: { classes: "bg-emerald-500/15 text-emerald-400", label: "Low" },
  medium: { classes: "bg-amber-500/15 text-amber-400", label: "Med" },
  high: { classes: "bg-orange-500/25 text-orange-200", label: "High" },
  critical: { classes: "bg-red-500/25 text-red-200", label: "Crit" },
};

const statusDot: Record<ChecklistItemStatus, string> = {
  pending: "bg-zinc-400",
  in_progress: "bg-blue-400",
  review: "bg-violet-400",
  blocked: "bg-red-400",
  done: "bg-emerald-400",
};

interface CardItemProps {
  card: SentinelCard;
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
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {doneCount}/{total}
      </span>
    </div>
  );
}

export function CardItem({ card }: CardItemProps) {
  const { selectedCardId } = useSentinel();
  const dispatch = useSentinelDispatch();
  const priority = priorityConfig[card.priority] ?? priorityConfig.medium;
  const isSelected = selectedCardId === card.id;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => dispatch({ type: "SELECT_CARD", cardId: isSelected ? null : card.id })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dispatch({ type: "SELECT_CARD", cardId: isSelected ? null : card.id });
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-2 rounded-lg border bg-card p-3 pl-3.5",
        "transition-all duration-150 outline-none",
        isSelected
          ? "border-violet-500/40 ring-1 ring-violet-500/20"
          : "border-border hover:border-border",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[2px] rounded-l-lg transition-colors",
          isSelected ? "bg-violet-500" : "bg-transparent group-hover:bg-violet-500/40",
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium leading-snug text-card-foreground">
          {card.title}
        </span>
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide",
            priority.classes,
          )}
        >
          {priority.label}
        </span>
      </div>

      {card.description && (
        <p className="text-xs leading-relaxed text-foreground/60 line-clamp-2">
          {card.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
        <ChecklistSummary card={card} />
      </div>
    </div>
  );
}
