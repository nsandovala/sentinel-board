import type { DockEvent, HeoSuggestion } from "@/types/event";

export const initialEvents: DockEvent[] = [
  {
    id: "ev-1",
    type: "system",
    message: "Sentinel Board iniciado — Command Dock activo",
    timestamp: new Date(Date.now() - 3600_000),
  },
  {
    id: "ev-2",
    type: "command",
    message: "\"Diseñar layout tipo IDE\" movido a → en_proceso",
    timestamp: new Date(Date.now() - 1800_000),
  },
  {
    id: "ev-3",
    type: "focus",
    message: "Sesión de foco: 2h 15min en Sentinel Board",
    timestamp: new Date(Date.now() - 900_000),
  },
  {
    id: "ev-4",
    type: "heo_suggestion",
    message: "HEO: Llevas 3 días sin mover \"Agregar proyecto TBB AMON Delivery\"",
    timestamp: new Date(Date.now() - 300_000),
  },
];

export const mockSuggestions: HeoSuggestion[] = [
  {
    id: "sug-1",
    text: "Mover AMON Delivery a prototipo funcional",
    command: "mover amon delivery a prototipo funcional",
  },
  {
    id: "sug-2",
    text: "Registrar 2h en Sentinel Board",
    command: "registrar 2 horas en sentinel board",
  },
  {
    id: "sug-3",
    text: "Iniciar foco en AMON Agents",
    command: "iniciar foco en amon agents",
  },
];
