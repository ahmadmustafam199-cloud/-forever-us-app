import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const patchEventSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eventTime: z.string().trim().max(16).optional(),
  category: z
    .enum(["anniversary", "date_night", "travel", "birthday", "milestone"])
    .optional(),
  location: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1500).optional(),
  reminder: z.boolean().optional(),
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
    const parsed = patchEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid event update." }, { status: 400 });
    }

    const [updated] = await db
      .update(calendarEvents)
      .set(parsed.data)
      .where(
        and(eq(calendarEvents.id, id), eq(calendarEvents.coupleId, auth.couple.id))
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    emitToCouple(auth.couple.id, "calendar:updated", { event: updated }, auth.user.id);
    return NextResponse.json({ event: updated });
  } catch (err) {
    console.error("Calendar PATCH error:", err);
    return NextResponse.json({ error: "Unable to update event." }, { status: 500 });
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
      .delete(calendarEvents)
      .where(
        and(eq(calendarEvents.id, id), eq(calendarEvents.coupleId, auth.couple.id))
      )
      .returning({ id: calendarEvents.id });

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    emitToCouple(auth.couple.id, "calendar:updated", { deletedId: id }, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("Calendar DELETE error:", err);
    return NextResponse.json({ error: "Unable to delete event." }, { status: 500 });
  }
}
