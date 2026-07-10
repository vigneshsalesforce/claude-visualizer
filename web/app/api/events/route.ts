import type { NextRequest } from "next/server";
import { getTailingState, startPolling, type Envelope } from "@/lib/tailing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  startPolling(); // no-op if instrumentation.ts already started it
  const state = getTailingState();

  let unsubscribe: () => void = () => {};
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (envelope: Envelope) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(envelope)}\n\n`));
        } catch {
          // controller already closed (client disconnected) - ignore
        }
      };

      unsubscribe = state.broadcaster.subscribe(send);
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          // ignore
        }
      }, 15000);

      request.signal.addEventListener("abort", () => {
        unsubscribe();
        if (keepAlive) clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      unsubscribe();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}



