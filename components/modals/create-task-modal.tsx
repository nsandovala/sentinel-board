"use client";

import { useState, useCallback, useEffect } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { nextCardId } from "@/lib/console/command-executor";
import type { SentinelCard } from "@/types/card";
import type { CardType, PriorityLevel } from "@/types/enums";
import { useSentinel, useSentinelDispatch } from "@/lib/state/sentinel-store";

const TYPES: CardType[] = [
  "task",
  "feature",
  "bug",
  "research",
  "idea",
];

const PRIORITIES: PriorityLevel[] = ["low", "medium", "high", "critical"];

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskModal({ open, onOpenChange }: CreateTaskModalProps) {
  const { projects } = useSentinel();
  const dispatch = useSentinelDispatch();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [type, setType] = useState<CardType>("task");
  const [priority, setPriority] = useState<PriorityLevel>("medium");

  useEffect(() => {
    if (open && projects.length && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [open, projects, projectId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const t = title.trim();
      if (!t || !projectId) return;

      const card: SentinelCard = {
        id: nextCardId(),
        title: t,
        description: description.trim() || undefined,
        status: "idea_bruta",
        type,
        priority,
        tags: [],
        projectId,
        checklist: [],
        blocked: false,
      };

      dispatch({ type: "CREATE_CARD", card });
      dispatch({ type: "SET_VIEW", view: "board" });
      dispatch({ type: "SELECT_CARD", cardId: card.id });
      setTitle("");
      setDescription("");
      onOpenChange(false);
    },
    [title, description, projectId, type, priority, dispatch, onOpenChange],
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
        aria-labelledby="create-task-title"
        className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-task-title" className="text-sm font-semibold text-foreground">
            Nueva tarea
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
            <label htmlFor="ct-title" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Título
            </label>
            <Input
              id="ct-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Revisar pipeline de deploy"
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="ct-desc" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Descripción (opcional)
            </label>
            <Textarea
              id="ct-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto breve…"
              className="min-h-20"
            />
          </div>
          <div>
            <label htmlFor="ct-proj" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Proyecto
            </label>
            <select
              id="ct-proj"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="ct-type" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Tipo
              </label>
              <select
                id="ct-type"
                value={type}
                onChange={(e) => setType(e.target.value as CardType)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm capitalize text-foreground outline-none focus-visible:border-ring dark:bg-input/30"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ct-prio" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Prioridad
              </label>
              <select
                id="ct-prio"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm capitalize text-foreground outline-none focus-visible:border-ring dark:bg-input/30"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>
              Crear en board
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
