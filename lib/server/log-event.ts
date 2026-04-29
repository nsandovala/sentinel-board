/**
 * log-event.ts
 *
 * Server-side helper to insert events into the `events` table.
 * Single source of truth for event persistence — use this instead
 * of inline db.insert(events) across routes and executors.
 */

import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import type { EventType } from "@/types/event";

export async function logDockEvent(
  type: EventType,
  message: string,
): Promise<string> {
  const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.insert(events).values({ id, type, message });
  return id;
}
