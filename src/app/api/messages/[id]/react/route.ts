import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { messages, messageReactions } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const reactSchema = z.object({
  emoji: z.string().trim().min(1).max(12),
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
    const parsed = reactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
    }

    const msgRows = await db
      .select({ id: messages.id, isDeleted: messages.isDeleted })
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.coupleId, auth.couple.id)))
      .limit(1);

    if (msgRows.length === 0 || msgRows[0].isDeleted) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    const existing = await db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, id),
          eq(messageReactions.userId, auth.user.id)
        )
      )
      .limit(1);

    if (existing.length > 0 && existing[0].emoji === parsed.data.emoji) {
      await db
        .delete(messageReactions)
        .where(eq(messageReactions.id, existing[0].id));
    } else if (existing.length > 0) {
      await db
        .update(messageReactions)
        .set({ emoji: parsed.data.emoji })
        .where(eq(messageReactions.id, existing[0].id));
    } else {
      await db.insert(messageReactions).values({
        messageId: id,
        userId: auth.user.id,
        emoji: parsed.data.emoji,
      });
    }

    const allReactions = await db
      .select({ userId: messageReactions.userId, emoji: messageReactions.emoji })
      .from(messageReactions)
      .where(eq(messageReactions.messageId, id));

    emitToCouple(auth.couple.id, "message:reacted", {
      messageId: id,
      reactions: allReactions,
    });

    return NextResponse.json({ messageId: id, reactions: allReactions });
  } catch (err) {
    console.error("Reaction POST error:", err);
    return NextResponse.json(
      { error: "Unable to react to message." },
      { status: 500 }
    );
  }
}
