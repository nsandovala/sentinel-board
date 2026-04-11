# Resumen Ejecutivo - TBB Bot v2.0

**Fecha:** 10 de Abril, 2026
**Estado:** MVP Implementado y Operativo
**Tiempo total:** ~1 hora

---

## Objetivo

Integrar sincronizacion automatica de pedidos desde WhatsApp Bot → Firebase Firestore, agregando validacion de direcciones y seleccion de metodo de pago.

---

## Completado

### 1. Seguridad y Credenciales
- Migracion de credenciales hardcodeadas → `.env`
- Instalacion de `dotenv` y `firebase-admin`
- Actualizacion de `.gitignore` para proteger credenciales

### 2. Base de Datos (SQLite)
- Migracion de schema: 11 columnas nuevas (sync, payment, validacion)
- Indices agregados para performance de queries de sync
- Nuevos metodos: `getPendingSync()`, `markAsSynced()`, `markAsError()`, `getPedidoById()`
- Compatible con BD existente (sin perdida de datos)

### 3. Firebase Bridge
- `bridge/firestore-client.js` - Inicializacion lazy con validacion de credenciales
- `bridge/sync.js` - Sincronizacion idempotente SQLite → Firestore
- `bridge/sync-scheduler.js` - Reintentos automaticos cada 5 min
- `bridge/validator.js` - Validacion de direccion y metodo de pago
- `bridge/mapping.js` - Mapeo explicito de combos → items Firestore

### 4. Flujo de Pedidos
- Nuevo estado: `ESPERANDO_METODO_PAGO`
- Validacion de direccion (minimo 8 chars + debe incluir numero + anti-genericas)
- 3 metodos de pago: Efectivo, Transferencia, Tarjeta al delivery
- Sync no bloqueante post-confirmacion (fire-and-forget)

### 5. Integracion
- Scheduler integrado en `index.js`
- Eliminada dependencia de `firestoreBridge.js` (archivo viejo)
- Fix de bug critico: coma faltante en `config.js`
- Fix de bug critico: `IF NOT EXISTS` no soportado en ALTER TABLE (SQLite)

---

## Arquitectura Actual

```
WhatsApp → Bot (index.js) → brain.js (maquina de estados)
                              ↓
                         database.js (SQLite)
                              ↓
                    bridge/sync-scheduler.js (cada 5 min)
                              ↓
                    bridge/sync.js → bridge/firestore-client.js
                              ↓
                         Firebase Firestore
```

---

## Archivos Modificados/Creados

| Archivo | Accion | Descripcion |
|---------|--------|-------------|
| `config.js` | Modificado | dotenv, fix coma, Firebase desde .env |
| `database.js` | Modificado | Migracion schema + nuevos metodos |
| `index.js` | Modificado | Remover firestoreBridge viejo + agregar scheduler |
| `.gitignore` | Modificado | Agregar .env, serviceAccountKey.json |
| `.env.example` | Nuevo | Template de variables de entorno |
| `bridge/firestore-client.js` | Nuevo | Inicializacion Firebase con validacion |
| `bridge/sync.js` | Nuevo | Logica de sincronizacion idempotente |
| `bridge/sync-scheduler.js` | Nuevo | Auto-retry cada 5 minutos |
| `bridge/validator.js` | Nuevo | Validacion direccion + metodo pago |
| `bridge/mapping.js` | Nuevo | Mapeo combos → Firestore items |

---

## Pendiente / Backlog

### Alto Prioridad
- [ ] Completar `.env` con credenciales reales de Firebase
- [ ] Test end-to-end: pedido completo → verificar en Firebase Console
- [ ] Eliminar archivo viejo `firestoreBridge.js`

### Backlog
- [ ] Agregar recargo automatico por distancia
- [ ] Detectar pedidos grandes
- [ ] Escalar reclamos a Nelson automaticamente
- [ ] Separar menu por categorias
- [ ] Integrar plantilla de resumen de pedido
- [ ] Rate limiting (si crece el volumen)
- [ ] Dashboard web para ver pedidos

---

## Configuracion Actual

| Variable | Valor |
|----------|-------|
| Modo Produccion | `true` |
| Tiempo de respuesta | 1200ms |
| Sync interval | 300s (5 min) |
| Max retries sync | 3 |
| Validacion direccion | Min 8 chars + debe incluir numero |
| Metodos de pago | Efectivo, Transferencia, Tarjeta |

---

## Tests Realizados

| Test | Resultado |
|------|-----------|
| Bot arranca sin errores | OK |
| Migracion de BD aplica correctamente | OK |
| Sync scheduler inicia | OK |
| Verificacion de sintaxis (node -c) | OK — Todos los archivos |

### Pendiente de Test
- [ ] Flujo completo de pedido (hola → confirmar)
- [ ] Validacion de direccion invalida
- [ ] Validacion de metodo de pago invalido
- [ ] Verificar documento en Firebase Console
- [ ] Sync automatico tras fallo de Firebase

---

## Variables de Entorno Necesarias

```bash
FIREBASE_PROJECT_ID=amon-delivery-prod
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n"
FIREBASE_TENANT_ID=tbb
ADMIN_PHONE=56955315829
```

---

## Bugs Detectados y Corregidos

| Bug | Severidad | Estado |
|-----|-----------|--------|
| Coma faltante en config.js (firebase no se exportaba) | Critico | Fixed |
| `IF NOT EXISTS` no soportado en ALTER TABLE (SQLite) | Critico | Fixed |
| `firestoreBridge.js` viejo bloqueaba arranque | Critico | Fixed |
| Espacios fantasmas en `@c.us` (telefonoAdmin) | Medio | Fixed |
| Credenciales hardcodeadas en codigo | Critico | Fixed |

---

## Metricas Base

- Pedidos en SQLite: _(ver con `sqlite3 tbb_pedidos.db "SELECT COUNT(*) FROM pedidos;"`)_
- Tasa de sync: _(pendiente de verificar tras primer pedido)_
- Errores de sync: _(ver con `sqlite3 tbb_pedidos.db "SELECT COUNT(*) FROM pedidos WHERE sync_status='error';"`)_

---

**Documento generado:** 10 de Abril, 2026
**Listo para:** Kanban board, revision de equipo, handoff
