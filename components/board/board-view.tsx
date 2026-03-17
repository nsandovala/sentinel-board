import { cards } from "@/lib/mock/cards";
import { CardStatus } from "@/types/enums";
import { SentinelCard } from "@/types/card";
import { Column } from "./column";

const statusColumns: { key: CardStatus; label: string }[] = [
  { key: "idea_bruta", label: "Idea Bruta" },
  { key: "clarificando", label: "Clarificando" },
  { key: "validando", label: "Validando" },
  { key: "en_proceso", label: "En Proceso" },
  { key: "desarrollo", label: "Desarrollo" },
  { key: "qa", label: "QA" },
  { key: "listo", label: "Listo" },
  { key: "produccion", label: "Producción" },
  { key: "archivado", label: "Archivado" },
];

function groupByStatus(
  items: SentinelCard[]
): Record<CardStatus, SentinelCard[]> {
  const grouped = {} as Record<CardStatus, SentinelCard[]>;
  for (const { key } of statusColumns) {
    grouped[key] = [];
  }
  for (const item of items) {
    grouped[item.status].push(item);
  }
  return grouped;
}

export function BoardView() {
  const grouped = groupByStatus(cards);

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4">
      {statusColumns.map(({ key, label }) => (
        <Column key={key} title={label} cards={grouped[key]} />
      ))}
    </div>
  );
}
