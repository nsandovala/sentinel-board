export type Severidad = "critica" | "alta" | "media" | "baja";

export interface RootCauseInput {
  symptom: string;
  taskId?: string;
  projectId?: string;
  recentEvents?: string[];
  currentStatus?: string;
  metadata?: {
    title?: string;
    blocked?: boolean;
    blockerReason?: string;
    priority?: string;
    type?: string;
    tags?: string[];
    checklistTotal?: number;
    checklistDone?: number;
    createdAt?: string;
    description?: string;
  };
}

export interface RootCauseAnalysis {
  id: string;
  taskId?: string;
  projectId?: string;

  problema_observable: string;
  causa_inmediata: string;
  por_que_1: string;
  por_que_2: string;
  por_que_3: string;
  por_que_4: string;
  por_que_5: string;
  causa_raiz: string;

  accion_correctiva: string;
  accion_preventiva: string;

  severidad: Severidad;
  requiere_agente: boolean;
  agente_sugerido?: string;
  confidence: number;

  evidencia: string[];
  supuestos: string[];

  createdAt: string;
}
