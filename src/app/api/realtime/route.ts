import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { addSubscriber, emitToCouple, isUserConnectedRealtime } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const subId = crypto.randomUUID();
  const userId = auth.user.id;
  const coupleId = auth.couple?.id ?? null;

  let cleanupFn: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        try {
          const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const unsubscribe = addSubscriber({
        id: subId,
        userId,
        coupleId,
        send: sendEvent,
      });

      // Notify partner that this spouse is online right now
      if (coupleId) {
        emitToCouple(
          coupleId,
          "presence",
          {
            userId,
            isOnline: true,
            lastSeenAt: new Date().toISOString(),
          },
          userId
        );
      }

      sendEvent("connected", {
        userId,
        coupleId,
        serverTime: new Date().toISOString(),
      });

      // Heartbeat every 20s to keep connection alive and update presence timestamp
      const heartbeat = setInterval(async () => {
        if (closed) return;
        sendEvent("ping", { ts: Date.now() });
        try {
          await db
            .update(users)
            .set({ isOnline: true, lastSeenAt: new Date() })
            .where(eq(users.id, userId));
        } catch {
          // ignore transient db error
        }
      }, 20_000);

      cleanupFn = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();

        // If user has no other open SSE connections, record lastSeenAt and broadcast offline
        if (!isUserConnectedRealtime(userId)) {
          const now = new Date();
          db.update(users)
            .set({ isOnline: false, lastSeenAt: now, typingUntil: null })
            .where(eq(users.id, userId))
            .then(() => {
              if (coupleId) {
                emitToCouple(
                  coupleId,
                  "presence",
                  {
                    userId,
                    isOnline: false,
                    lastSeenAt: now.toISOString(),
                    isTyping: false,
                  },
                  userId
                );
              }
            })
            .catch(() => {});
        }
      };

      req.signal.addEventListener("abort", () => {
        cleanupFn?.();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      cleanupFn?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
