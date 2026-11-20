import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, desc, asc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { callLogs, callSignals, notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const signalCallId = url.searchParams.get("callId");

    // Auto-expire stale ringing calls older than 65 seconds
    const activeRows = await db
      .select()
      .from(callLogs)
      .where(
        and(
          eq(callLogs.coupleId, auth.couple.id),
          inArray(callLogs.status, ["ringing", "active"])
        )
      )
      .orderBy(desc(callLogs.startedAt));

    const now = new Date();
    let activeCall = null;
    for (const row of activeRows) {
      if (
        row.status === "ringing" &&
        now.getTime() - new Date(row.startedAt).getTime() > 65_000
      ) {
        await db
          .update(callLogs)
          .set({ status: "missed", endedAt: now })
          .where(eq(callLogs.id, row.id));
      } else if (!activeCall) {
        activeCall = row;
      }
    }

    let signals: Array<{
      id: string;
      senderId: string;
      signalType: string;
      payload: string;
      createdAt: string;
    }> = [];

    if (signalCallId && /^[0-9a-fA-F-]{36}$/.test(signalCallId)) {
      const sigRows = await db
        .select()
        .from(callSignals)
        .where(
          and(
            eq(callSignals.callId, signalCallId),
            eq(callSignals.coupleId, auth.couple.id),
            ne(callSignals.senderId, auth.user.id)
          )
        )
        .orderBy(asc(callSignals.createdAt));

      signals = sigRows.map((s) => ({
        id: s.id,
        senderId: s.senderId,
        signalType: s.signalType,
        payload: s.payload,
        createdAt: new Date(s.createdAt).toISOString(),
      }));
    }

    const historyRows = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.coupleId, auth.couple.id))
      .orderBy(desc(callLogs.startedAt))
      .limit(40);

    return NextResponse.json({
      activeCall,
      signals,
      calls: historyRows,
    });
  } catch (err) {
    console.error("Calls GET error:", err);
    return NextResponse.json(
      { error: "Unable to load call history." },
      { status: 500 }
    );
  }
}

const startCallSchema = z.object({
  callType: z.enum(["audio", "video"]),
});

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple || !auth.partner) {
      return NextResponse.json(
        { error: "Connect with your spouse before placing a call." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = startCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid call type." }, { status: 400 });
    }

    // End any lingering ringing calls in this couple
    await db
      .update(callLogs)
      .set({ status: "missed", endedAt: new Date() })
      .where(
        and(eq(callLogs.coupleId, auth.couple.id), eq(callLogs.status, "ringing"))
      );

    const [call] = await db
      .insert(callLogs)
      .values({
        coupleId: auth.couple.id,
        callerId: auth.user.id,
        calleeId: auth.partner.id,
        callType: parsed.data.callType,
        status: "ringing",
        startedAt: new Date(),
      })
      .returning();

    const [notif] = await db
      .insert(notifications)
      .values({
        coupleId: auth.couple.id,
        recipientId: auth.partner.id,
        actorId: auth.user.id,
        kind: "call",
        title: `Incoming ${parsed.data.callType === "video" ? "Video" : "Audio"} Call`,
        body: `${auth.user.displayName} is calling you on Forever Us ❤️`,
      })
      .returning();

    emitToCouple(
      auth.couple.id,
      "call:incoming",
      {
        call,
        callerName: auth.user.displayName,
      },
      auth.user.id
    );
    emitToCouple(
      auth.couple.id,
      "notification:new",
      { notification: notif },
      auth.user.id
    );

    return NextResponse.json({ call }, { status: 201 });
  } catch (err) {
    console.error("Call POST error:", err);
    return NextResponse.json(
      { error: "Unable to initiate call." },
      { status: 500 }
    );
  }
}
