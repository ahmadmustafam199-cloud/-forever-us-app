import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const editSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(8000),
  isEncrypted: z.boolean().optional(),
  encryptionIv: z.string().max(64).nullable().optional(),
});

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
    const body = await req.json();
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid message edit." },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.coupleId, auth.couple.id)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    const existing = rows[0];
    if (existing.senderId !== auth.user.id) {
      return NextResponse.json(
        { error: "You can only edit your own messages." },
        { status: 403 }
      );
    }
    if (existing.isDeleted) {
      return NextResponse.json(
        { error: "Deleted messages cannot be edited." },
        { status: 400 }
      );
    }

    const now = new Date();
    const [updated] = await db
      .update(messages)
      .set({
        content: parsed.data.content,
        isEncrypted: parsed.data.isEncrypted ?? existing.isEncrypted,
        encryptionIv:
          parsed.data.encryptionIv !== undefined
            ? parsed.data.encryptionIv
            : existing.encryptionIv,
        isEdited: true,
        updatedAt: now,
      })
      .where(eq(messages.id, id))
      .returning();

    const payload = {
      id: updated.id,
      content: updated.content,
      isEncrypted: updated.isEncrypted,
      encryptionIv: updated.encryptionIv,
      isEdited: true,
      updatedAt: now.toISOString(),
    };

    emitToCouple(auth.couple.id, "message:updated", payload, auth.user.id);

    return NextResponse.json({ message: payload });
  } catch (err) {
    console.error("Message PATCH error:", err);
    return NextResponse.json(
      { error: "Unable to edit message." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.coupleId, auth.couple.id)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    if (rows[0].senderId !== auth.user.id) {
      return NextResponse.json(
        { error: "You can only delete your own messages." },
        { status: 403 }
      );
    }

    await db
      .update(messages)
      .set({
        isDeleted: true,
        content: "",
        mediaId: null,
        stickerId: null,
        isEncrypted: false,
        encryptionIv: null,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, id));

    emitToCouple(auth.couple.id, "message:deleted", { id }, auth.user.id);

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Message DELETE error:", err);
    return NextResponse.json(
      { error: "Unable to delete message." },
      { status: 500 }
    );
  }
}
