"use client";

import { Bot, Activity } from "lucide-react";

export type AgentStatus = "idle" | "running" | "done" | "error";

interface AgentDef {
  key: string;
  name: string;
}

const AGENTS: AgentDef[] = [
  { key: "planner", name: "planner" },
  { key: "state-guardian", name: "state-guardian" },
  { key: "qa-reviewer", name: "qa-reviewer" },
  { key: "scorer", name: "scorer" },
];

interface AgentsModeProps {
  expanded?: boolean;
}

export function AgentsMode(_props: AgentsModeProps) {
  return (
    <div className="flex flex-col gap-2.5 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground/75" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/85">
            Runtime
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border/30 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
          <Activity className="h-3 w-3" aria-hidden />
          Event Stream de AMON Agents se conectará en una fase posterior.
        </span>
      </div>

      <ul className="flex flex-col divide-y divide-border/20 overflow-hidden rounded-md border border-border/30 bg-background/30">
        {AGENTS.map((agent) => (
          <li
            key={agent.key}
            className="flex items-center justify-between gap-3 px-3 py-1.5"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/35"
                aria-hidden
              />
              <span className="font-mono text-[12px] text-foreground/80">
                {agent.name}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/55">
              idle
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
