import { NextRequest } from "next/server";
import { syncBus, SSEEventType, SSEPayload } from "@/lib/server/sync-bus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (type: SSEEventType, data?: unknown) => {
        const payload: SSEPayload = {
          type,
          timestamp: new Date().toISOString(),
          data,
        };
        const chunk = `data: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      sendEvent("refresh");

      const handler = (payload: SSEPayload) => {
        const chunk = `data: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      syncBus.on("event", handler);

      req.signal.addEventListener("abort", () => {
        syncBus.off("event", handler);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}