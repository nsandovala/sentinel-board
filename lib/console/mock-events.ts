import type { DockEvent, HeoSuggestion } from "@/types/event";

export const initialEvents: DockEvent[] = [
  {
    id: "ev-1",
    type: "system",
    message: "Sentinel Board iniciado — Command Dock activo",
    timestamp: new Date(Date.now() - 3600_000),
  },
  {
    id: "ev-4",
    type: "system",
    message: "Persistencia SQLite + Drizzle implementada (Etapa 1)",
    timestamp: new Date(Date.now() - 1800_000),
  },
  {
    id: "ev-6",
    type: "command",
    message: "TBB Bot v2.0 — MVP implementado: sync WhatsApp → Firebase",
    timestamp: new Date(Date.now() - 900_000),
  },
  {
    id: "ev-7",
    type: "heo_suggestion",
    message: 'HEO: "Test e2e TBB Bot" bloqueada — necesita credenciales Firebase',
    timestamp: new Date(Date.now() - 300_000),
  },
];

export const mockSuggestions: HeoSuggestion[] = [
  {
    id: "sug-1",
    text: "Completar .env Firebase para TBB",
    command: "mover completar .env a en proceso",
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
