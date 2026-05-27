/**
 * POST /api/copilot/respond
 *
 * Conversational fallback for HEO Copilot when the dock parser can't
 * recognize the user input. Sends the message (plus optional card context)
 * to the AI router and returns the model's reply.
 *
 * Never executes shell. Never echoes env vars or secrets. Only forwards
 * the user's text + a minimal, server-side-formatted card snapshot.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { routeAI } from "@/lib/ai/ai-router";
import { rejectIfUnauthorized } from "@/lib/server/request-guard";
import {
  buildCopilotPrompt,
  extractSuggestedCommand,
  type CopilotCardContext,
} from "@/lib/server/copilot-prompt";
import type { CardStatus, PriorityLevel } from "@/types/enums";

export const dynamic = "force-dynamic";

const cardStatus: [CardStatus, ...CardStatus[]] = [
  "idea_bruta",
  "clarificando",
  "validando",
  "en_proceso",
  "desarrollo",
  "qa",
  "listo",
  "produccion",
  "archivado",
];

const priority: [PriorityLevel, ...PriorityLevel[]] = [
  "critical",
  "high",
  "medium",
  "low",
];

const cardSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(4000).optional(),
  status: z.enum(cardStatus),
  priority: z.enum(priority).optional(),
  projectName: z.string().max(200).optional(),
  tags: z.array(z.string().max(80)).max(40).optional(),
  checklist: z
    .array(
      z.object({
        text: z.string().max(400),
        status: z.string().max(40),
      }),
    )
    .max(40)
    .optional(),
  blocked: z.boolean().optional(),
  blockerReason: z.string().max(500).optional(),
});

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  card: cardSchema.optional(),
  projectName: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const denied = rejectIfUnauthorized(req);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, provider: "none", text: "", error: "Body JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        provider: "none",
        text: "",
        error: "Body inválido",
        issues: parsed.error.issues.slice(0, 5),
      },
      { status: 400 },
    );
  }

  const { systemPrompt, userPrompt } = buildCopilotPrompt({
    message: parsed.data.message,
    card: parsed.data.card as CopilotCardContext | undefined,
    projectName: parsed.data.projectName,
  });

  try {
    const result = await routeAI(systemPrompt, userPrompt);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: result.provider,
          text: "",
          suggestedCommand: null,
          error: result.error ?? "Sin respuesta de los providers",
        },
        { status: 502 },
      );
    }

    const { text, suggestedCommand } = extractSuggestedCommand(result.rawText);

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      text,
      suggestedCommand,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        provider: "none",
        text: "",
        error: err instanceof Error ? err.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
