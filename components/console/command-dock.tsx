"use client";

import { DockWorkspace } from "./dock/dock-workspace";

/**
 * Punto de entrada del Workspace Panel inferior.
 * La implementación vive en `components/console/dock/`, organizada por modo
 * (command / analyze / focus / agents). Este wrapper preserva el nombre
 * histórico para no romper imports existentes.
 */
export function CommandDock() {
  return <DockWorkspace />;
}
