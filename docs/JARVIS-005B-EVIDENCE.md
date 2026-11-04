# JARVIS-005B — evidencia técnica para revisión

Base inspeccionada el 31-10-2026: AA `a1717ff1c93398f7be352ae17d8f12c734d62442`, SB `be938e2603ba83263b6755e0b132004adefda57a`. Ambas ramas `main` estaban limpias y sincronizadas con `origin/main`. La única rama remota previa de SB (`feat/sentinel-terminal-v2`) no contenía Snapshot Ingest. No se encontró un issue o PR JARVIS-005B en ambos repositorios.

## Cambios propuestos

- SB consume el snapshot de AA mediante una URL HTTP loopback exacta, solo desde su servidor local de desarrollo.
- Proyecta estados desde heartbeat, jobs y revisiones recientes; conserva el modo NDJSON para el pipeline anterior.
- Muestra Worker, Jarvis, Claudio, Guardian, trabajos, veredictos y solicitudes de revisión dentro del Dock.
- Sustituye la ruta absoluta NDJSON que recibía el navegador por el nombre del archivo.
- No se modificó AA: su contrato actual basta para la ingesta. La vista de SB evita usar el estado `agents` histórico de AA, que puede conservar un bloqueo antiguo.

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| SB `npm run test:ops` | 8 pruebas, 8 pasan |
| SB `tsc --noEmit` | Pasa |
| SB lint de archivos modificados | Pasa; 1 aviso previo de `_props` sin uso en `agents-mode.tsx` |
| SB `npm run build` con `DATABASE_URL` ficticia a `127.0.0.1:1` | Pasa; incluye `/api/runtime/ops` |
| AA `npm test` | 211 pruebas, 211 pasan |
| AA `npm run typecheck` y `npm run build` | Pasan |
| `git diff --check` | Pasa |

La primera ejecución del build SB sin `DATABASE_URL` se detuvo al cargar `/api/events`; es un requisito existente del proyecto. La segunda usó una URL inalcanzable para validar el build sin conectar ni escribir en una BD.

## Pendiente para cierre

QA humano con AA y SB locales, revisión de usabilidad por Nelson y aprobación del PR draft. No se hizo merge, deploy ni escritura a BD. R2/R3 de confiabilidad y recuperación quedan como seguimiento separado.
