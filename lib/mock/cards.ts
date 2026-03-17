import { SentinelCard } from "@/types/card";

export const cards: SentinelCard[] = [
  {
    id: "c1",
    title: "Diseñar layout tipo IDE",
    description: "Definir sidebar izquierda, board central y panel derecho HEO.",
    status: "en_proceso",
    type: "feature",
    priority: "high",
    tags: ["ui", "layout", "core"],
    projectId: "5",
    checklist: [
      { id: "cl-1", text: "Definir grid principal", status: "done" },
      { id: "cl-2", text: "Crear sidebar colapsable", status: "in_progress" },
      { id: "cl-3", text: "Crear right panel HEO", status: "pending" },
      { id: "cl-4", text: "Revisar responsive en mobile", status: "blocked" },
    ],
    blocked: false,
  },
  {
    id: "c2",
    title: "Agregar proyecto TBB AMON Delivery al board",
    description: "Incluir repo y tareas iniciales del delivery dev.",
    status: "idea_bruta",
    type: "task",
    priority: "medium",
    tags: ["repo", "integration"],
    projectId: "4",
    checklist: [
      { id: "cl-5", text: "Vincular repositorio GitHub", status: "pending" },
      { id: "cl-6", text: "Definir tareas iniciales del sprint", status: "pending" },
    ],
    blocked: false,
  },
  {
    id: "c3",
    title: "Definir motor Código del Dinero",
    description: "Crear scoring inicial para priorización.",
    status: "validando",
    type: "research",
    priority: "high",
    tags: ["scoring", "codex"],
    projectId: "5",
    checklist: [
      { id: "cl-7", text: "Investigar modelos de scoring", status: "done" },
      { id: "cl-8", text: "Definir variables del motor", status: "done" },
      { id: "cl-9", text: "Crear fórmula base", status: "review" },
      { id: "cl-10", text: "Validar con datos reales", status: "in_progress" },
      { id: "cl-11", text: "Documentar criterios", status: "pending" },
    ],
    blocked: false,
  },
];