import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { callLogs, callSignals } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const signalSchema = z.object({
  signalType: z.enum(["offer", "answer", "ice-candidate", "media-state", "hangup"]),
  payload: z.string().max(64000),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = signalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid WebRTC signal." }, { status: 400 });
    }

    const callRows = await db
      .select({ id: callLogs.id })
      .from(callLogs)
      .where(and(eq(callLogs.id, id), eq(callLogs.coupleId, auth.couple.id)))
      .limit(1);

    if (callRows.length === 0) {
      return NextResponse.json({ error: "Call not found." }, { status: 404 });
    }

    const [sig] = await db
      .insert(callSignals)
      .values({
        callId: id,
        coupleId: auth.couple.id,
        senderId: auth.user.id,
        signalType: parsed.data.signalType,
        payload: parsed.data.payload,
      })
      .returning();

    emitToCouple(
      auth.couple.id,
      "call:signal",
      {
        id: sig.id,
        callId: id,
        senderId: auth.user.id,
        signalType: sig.signalType,
        payload: sig.payload,
      },
      auth.user.id
    );

    return NextResponse.json({ signalId: sig.id }, { status: 201 });
  } catch (err) {
    console.error("Call signal error:", err);
    return NextResponse.json(
      { error: "Unable to relay call signal." },
      { status: 500 }
    );
  }
}
