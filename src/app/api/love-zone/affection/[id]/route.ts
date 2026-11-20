import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { affections, notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const rows = await db
      .select()
      .from(affections)
      .where(and(eq(affections.id, id), eq(affections.coupleId, auth.couple.id)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Surprise not found." }, { status: 404 });
    }

    const surprise = rows[0];
    if (surprise.unlockAt && new Date(surprise.unlockAt).getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: `This surprise unlocks on ${new Date(
            surprise.unlockAt
          ).toLocaleString()}.`,
        },
        { status: 403 }
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(affections)
      .set({ isOpened: true, openedAt: surprise.openedAt ?? now })
      .where(eq(affections.id, id))
      .returning();

    if (auth.partner && surprise.senderId === auth.partner.id && !surprise.isOpened) {
      const [notif] = await db
        .insert(notifications)
        .values({
          coupleId: auth.couple.id,
          recipientId: auth.partner.id,
          actorId: auth.user.id,
          kind: "affection",
          title: "Surprise Unwrapped! 💝",
          body: `${auth.user.displayName} just opened "${surprise.title}"!`,
        })
        .returning();

      emitToCouple(
        auth.couple.id,
        "notification:new",
        { notification: notif },
        auth.user.id
      );
    }

    return NextResponse.json({
      surprise: {
        id: updated.id,
        senderId: updated.senderId,
        title: updated.title,
        note: updated.note,
        unlockAt: updated.unlockAt ? new Date(updated.unlockAt).toISOString() : null,
        isLockedByTime: false,
        isOpened: true,
        openedAt: updated.openedAt ? new Date(updated.openedAt).toISOString() : null,
        createdAt: new Date(updated.createdAt).toISOString(),
      },
    });
  } catch (err) {
    console.error("Surprise PATCH error:", err);
    return NextResponse.json(
      { error: "Unable to open surprise." },
      { status: 500 }
    );
  }
}
