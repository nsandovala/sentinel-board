import { SentinelCard } from "@/types/card";
import { CardItem } from "./card-item";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColumnProps {
  title: string;
  cards: SentinelCard[];
}

export function Column({ title, cards }: ColumnProps) {
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="text-xs tabular-nums text-muted-foreground/60">
          {cards.length}
        </span>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 px-1 pb-4">
          {cards.map((card) => (
            <CardItem key={card.id} card={card} />
          ))}
          {cards.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground/40">
              Sin tarjetas
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
