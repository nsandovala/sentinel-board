import { SentinelCard } from "@/types/card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const priorityStyle: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-400",
  medium: "bg-amber-500/15 text-amber-400",
  high: "bg-orange-500/15 text-orange-400",
  critical: "bg-red-500/15 text-red-400",
};

interface CardItemProps {
  card: SentinelCard;
}

export function CardItem({ card }: CardItemProps) {
  return (
    <Card
      size="sm"
      className="hover:ring-foreground/20 transition-[box-shadow]"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-[13px] leading-snug">
            {card.title}
          </CardTitle>
          <Badge
            className={cn(
              "shrink-0 text-[10px] capitalize",
              priorityStyle[card.priority]
            )}
          >
            {card.priority}
          </Badge>
        </div>
        {card.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {card.description}
          </p>
        )}
      </CardHeader>

      {card.tags.length > 0 && (
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {card.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] font-normal"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
