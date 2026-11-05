import { authorizeApi, resolveUserSession } from "@/lib/server/api-auth";
import { NextRequest } from "next/server";
import { syncBus, SSEEventType, SSEPayload } from "@/lib/server/sync-bus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let expiresAt = 0;
  const denied = await authorizeApi(req, async () => {
    const principal = await resolveUserSession();
    expiresAt = principal?.expiresAt ?? 0;
    return principal;
  });
  if (denied) return denied;
  const encoder = new TextEncoder();
  let cleanup = () => {};

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

      let closed = false;
      const close = () => {
        if (closed) return;
        cleanup();
        controller.close();
      };
      // EventSource reconnects and reauthorizes. An already open stream must
      // not outlive its verified session token, including after sign-out.
      const timer = setTimeout(close, Math.max(0, Math.min(expiresAt - Date.now(), 60_000)));
      cleanup = () => {
        closed = true;
        clearTimeout(timer);
        syncBus.off("event", handler);
        req.signal.removeEventListener("abort", close);
      };
      if (req.signal.aborted) close();
      else req.signal.addEventListener("abort", close, { once: true });
    },
    cancel() { cleanup(); },
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
