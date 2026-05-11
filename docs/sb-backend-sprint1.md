# Sentinel Board - Backend Sprint 1

## Overview
Complete backend-first implementation of core operational features for Sentinel Board (SB).

## Deliverables

### 1. Database Schema Extensions
**File:** `lib/db/schema.ts`

Added tables:
- `suggestion_feedback` - Persists user feedback on AI suggestions
- `system_insights` - Stores detected insights from rules engine

### 2. Backend Services
**Files created in `lib/server/`:**

| File | Purpose |
|------|---------|
| `sync-bus.ts` | SSE event emitter infrastructure |
| `feedback-service.ts` | CRUD for suggestion feedback + metrics |
| `insight-engine.ts` | Deterministic rules for insights detection |

### 3. API Routes

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/feedback` | GET, POST | List/create feedback |
| `/api/insights` | GET, PATCH | List/update insight status |
| `/api/insights/run` | POST | Trigger insight engine |
| `/api/stream` | GET | SSE event stream |

### 4. SSE Integration
Modified endpoints to emit events:
- `app/api/tasks/route.ts` - task created
- `app/api/tasks/[id]/route.ts` - task updated/deleted  
- `app/api/focus-sessions/route.ts` - focus started/ended
- `lib/server/action-executor.ts` - card moved via terminal

---

## Risk Assessment

### Mitigated
- ✅ Input validation on all POST/PATCH endpoints
- ✅ Text sanitization (length limits, control char removal)
- ✅ Whitelist validation for enums (source, decision, status)
- ✅ No secrets in responses

### Pending (Phase 2)
- ⚠️ Rate limiting on POST endpoints
- ⚠️ Auth/authz layer
- ⚠️ WebSocket fallback for clients that can't do SSE
- ⚠️ Insight deduplication (currently basic, may miss edge cases)

---

## Manual Testing Guide

### 1. Feedback API
```bash
# Create feedback
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"projectId":"sb","source":"terminal","suggestionType":"move_status","content":"Move to qa","decision":"accepted"}'

# List feedback
curl "http://localhost:3000/api/feedback?projectId=sb&metrics=true"
```

### 2. Insights API
```bash
# Run insight engine
curl -X POST http://localhost:3000/api/insights/run \
  -H "Content-Type: application/json" \
  -d '{"projectId":"sb"}'

# List insights
curl "http://localhost:3000/api/insights?projectId=sb"

# Update insight status
curl -X PATCH http://localhost:3000/api/insights \
  -H "Content-Type: application/json" \
  -d '{"id":"ins-xxx","status":"resolved"}'
```

### 3. SSE Stream
```bash
curl -N http://localhost:3000/api/stream
```
Then in another terminal:
```bash
# Trigger a task update
curl -X PATCH http://localhost:3000/api/tasks/some-task-id \
  -H "Content-Type: application/json" \
  -d '{"status":"qa"}'
```
Should see SSE event in the stream.

### 4. Terminal → Board Sync
1. Open board in browser
2. Open terminal panel
3. Run: `mover "Task Name" a qa`
4. Board should update without page refresh

---

## Files Modified/Created

### Created
- `lib/server/sync-bus.ts` ✨
- `lib/server/feedback-service.ts` ✨
- `lib/server/insight-engine.ts` ✨
- `app/api/feedback/route.ts` ✨
- `app/api/insights/route.ts` ✨
- `app/api/insights/run/route.ts` ✨
- `app/api/stream/route.ts` ✨

### Modified
- `lib/db/schema.ts` (added tables)
- `app/api/tasks/route.ts` (SSE emit on create)
- `app/api/tasks/[id]/route.ts` (SSE emit on update/delete)
- `app/api/focus-sessions/route.ts` (SSE emit on start/end)
- `lib/server/action-executor.ts` (SSE emit on move_card)

---

## Phase 2 TODO

From scope but deferred:
- [ ] WebSocket fallback for SSE
- [ ] Rate limiting middleware
- [ ] Multi-project insight aggregation
- [ ] Insight auto-dismiss rules
- [ ] Feedback-based suggestion tuning (ML)
- [ ] Vector DB for semantic search (rejected for now)
- [ ] Multi-agent orchestration (rejected for now)

---

## Notes
- SSE uses EventEmitter in Node - works in dev/prod (Next.js API routes are serverless-compatible per-request)
- No breaking changes to existing UI
- Board, Command Dock, Terminal all function as before
- New SSE capability available but not wired to frontend components yet (intentional - frontend integration is Phase 2)