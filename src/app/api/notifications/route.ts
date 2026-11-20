import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, auth.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    return NextResponse.json({ notifications: rows });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return NextResponse.json(
      { error: "Unable to load notifications." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "mark_all_read") {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.recipientId, auth.user.id));
      return NextResponse.json({ success: true });
    }

    if (action === "ping_partner" && auth.couple && auth.partner) {
      const [notif] = await db
        .insert(notifications)
        .values({
          coupleId: auth.couple.id,
          recipientId: auth.partner.id,
          actorId: auth.user.id,
          kind: "affection",
          title: `${auth.user.displayName} is thinking of you ❤️`,
          body: "Just tapped to remind you how deeply loved you are right this second.",
        })
        .returning();

      emitToCouple(
        auth.couple.id,
        "notification:new",
        { notification: notif },
        auth.user.id
      );
      emitToCouple(
        auth.couple.id,
        "affection:burst",
        {
          id: notif.id,
          senderId: auth.user.id,
          senderName: auth.user.displayName,
          kind: "sparkle",
          emoji: "❤️",
          title: "Thinking of You!",
          note: `${auth.user.displayName} sent a heartbeat ping straight to your phone ❤️`,
        },
        auth.user.id
      );

      return NextResponse.json({ success: true, notification: notif });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error("Notifications POST error:", err);
    return NextResponse.json(
      { error: "Unable to update notifications." },
      { status: 500 }
    );
  }
}
