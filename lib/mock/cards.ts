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
      { id: "1", text: "Definir grid principal", done: true },
      { id: "2", text: "Crear sidebar", done: false },
      { id: "3", text: "Crear right panel", done: false },
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
    checklist: [],
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
    checklist: [],
    blocked: false,
  },
];