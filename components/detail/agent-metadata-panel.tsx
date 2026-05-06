import type { ReactNode } from "react";
import { Bot, FileCode2, ShieldAlert, TestTube2 } from "lucide-react";
import { extractCardMetadata } from "@/lib/analysis/card-metadata";
import type { SentinelCard } from "@/types/card";
import type { DockEvent } from "@/types/event";

function eventBelongsToCard(event: DockEvent, card: SentinelCard): boolean {
  const lowerMessage = event.message.toLowerCase();
  const lowerTitle = card.title.toLowerCase();

  if (lowerMessage.includes(`"${lowerTitle}"`)) return true;
  if (lowerMessage.includes(lowerTitle)) return true;
  return false;
}

function MetaList({
  title,
  items,
  empty,
  icon,
}: {
  title: string;
  items: string[];
  empty: string;
  icon: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className="sentinel-rail-section-label">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-md border border-border/20 bg-background/35 px-2.5 py-2 text-[11px] leading-relaxed text-foreground/80"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AgentMetadataPanel({
  card,
  events,
}: {
  card: SentinelCard;
  events: DockEvent[];
}) {
  const metadata = extractCardMetadata(card);
  const timeline = events
    .filter((event) => eventBelongsToCard(event, card))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 6);

  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        <Bot className="h-3.5 w-3.5 text-primary/40" />
        <h3 className="sentinel-rail-section-label">AMON Metadata</h3>
      </div>
      <div className="sentinel-glass-panel p-3.5">
        <div className="mb-4 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {metadata.source && (
            <span className="rounded-md border border-border/25 bg-muted/50 px-2 py-1 uppercase tracking-[0.08em]">
              {metadata.source}
            </span>
          )}
          {metadata.agent && (
            <span className="rounded-md border border-border/25 bg-muted/50 px-2 py-1">
              agent: {metadata.agent}
            </span>
          )}
          {metadata.externalTaskId && (
            <span className="rounded-md border border-border/25 bg-muted/50 px-2 py-1">
              ref: {metadata.externalTaskId}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <MetaList
            title="Plan"
            items={metadata.plan}
            empty="Sin plan estructurado en metadata."
            icon={<FileCode2 className="h-3.5 w-3.5 text-primary/35" />}
          />

          <MetaList
            title="Validaciones"
            items={metadata.validations}
            empty="Sin validaciones declaradas."
            icon={<TestTube2 className="h-3.5 w-3.5 text-primary/35" />}
          />

          <MetaList
            title="Done When"
            items={metadata.done_when}
            empty="Sin criterio de salida definido."
            icon={<TestTube2 className="h-3.5 w-3.5 text-primary/35" />}
          />

          <MetaList
            title="Files To Touch"
            items={metadata.files_to_touch}
            empty="Sin archivos sugeridos por el agente."
            icon={<FileCode2 className="h-3.5 w-3.5 text-primary/35" />}
          />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-primary/35" />
              <p className="sentinel-rail-section-label">Riesgos</p>
            </div>
            {metadata.risks.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Sin riesgos declarados por el agente.
              </p>
            ) : (
              <div className="space-y-2">
                {metadata.risks.map((risk) => (
                  <div
                    key={risk.label}
                    className="rounded-md border border-border/20 bg-background/35 px-2.5 py-2 text-[11px] leading-relaxed text-foreground/80"
                  >
                    <p>{risk.label}</p>
                    {risk.mitigation && (
                      <p className="mt-1 text-muted-foreground">Mitigacion: {risk.mitigation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {(metadata.state_guardian || metadata.qa_review || metadata.scoring_detail) && (
            <div className="space-y-3 rounded-md border border-border/20 bg-background/30 p-3">
              {metadata.state_guardian && (
                <div>
                  <p className="sentinel-rail-section-label mb-1">State Guardian</p>
                  <p className="text-[11px] leading-relaxed text-foreground/80">
                    {metadata.state_guardian}
                  </p>
                </div>
              )}
              {metadata.qa_review && (
                <div>
                  <p className="sentinel-rail-section-label mb-1">QA Review</p>
                  <p className="text-[11px] leading-relaxed text-foreground/80">
                    {metadata.qa_review}
                  </p>
                </div>
              )}
              {metadata.scoring_detail && (
                <div>
                  <p className="sentinel-rail-section-label mb-1">Scoring Detail</p>
                  <p className="text-[11px] leading-relaxed text-foreground/80">
                    {metadata.scoring_detail}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="sentinel-rail-section-label">Timeline</p>
            {timeline.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Sin eventos recientes asociados a esta card.
              </p>
            ) : (
              <div className="space-y-1.5">
                {timeline.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-md border border-border/15 bg-background/35 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {event.type}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {event.timestamp.toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
                      {event.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
