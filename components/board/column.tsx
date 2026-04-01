import { useDroppable } from "@dnd-kit/core";
import { SentinelCard } from "@/types/card";
import { CardStatus } from "@/types/enums";
import { CardItem } from "./card-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ColumnProps {
  title: string;
  status: CardStatus;
  cards: SentinelCard[];
}

export function Column({ title, status, cards }: ColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: `column-${status}`, data: { status } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border border-border bg-muted/20 transition-colors duration-150",
        isOver && "border-primary/30 bg-primary/[0.04]",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/90">
          {title}
        </h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-foreground/50">
          {cards.length}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 p-2 pb-4">
          {cards.map((card) => (
            <CardItem key={card.id} card={card} />
          ))}
          {cards.length === 0 && (
            <p className={cn(
              "py-8 text-center text-xs text-muted-foreground transition-colors",
              isOver && "text-primary/50",
            )}>
              {isOver ? "Soltar aqui" : "Sin tarjetas"}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
