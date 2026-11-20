import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const patchMemorySchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  caption: z.string().trim().max(2000).optional(),
  album: z.string().trim().min(1).max(80).optional(),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isFavorite: z.boolean().optional(),
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
    const parsed = patchMemorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid memory update." }, { status: 400 });
    }

    const [updated] = await db
      .update(memories)
      .set(parsed.data)
      .where(and(eq(memories.id, id), eq(memories.coupleId, auth.couple.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Memory not found." }, { status: 404 });
    }

    emitToCouple(auth.couple.id, "memory:updated", { memory: updated }, auth.user.id);
    return NextResponse.json({ memory: updated });
  } catch (err) {
    console.error("Memory PATCH error:", err);
    return NextResponse.json(
      { error: "Unable to update memory." },
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
    const deleted = await db
      .delete(memories)
      .where(and(eq(memories.id, id), eq(memories.coupleId, auth.couple.id)))
      .returning({ id: memories.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Memory not found." }, { status: 404 });
    }

    emitToCouple(auth.couple.id, "memory:deleted", { id }, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Memory DELETE error:", err);
    return NextResponse.json(
      { error: "Unable to delete memory." },
      { status: 500 }
    );
  }
}
