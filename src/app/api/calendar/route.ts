import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents, notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.coupleId, auth.couple.id))
      .orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.eventTime));

    return NextResponse.json({ events: rows });
  } catch (err) {
    console.error("Calendar GET error:", err);
    return NextResponse.json(
      { error: "Unable to load shared calendar." },
      { status: 500 }
    );
  }
}

const createEventSchema = z.object({
  title: z.string().trim().min(1, "Please enter an event title").max(160),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eventTime: z.string().trim().min(1).max(16).default("19:30"),
  category: z
    .enum(["anniversary", "date_night", "travel", "birthday", "milestone"])
    .default("date_night"),
  location: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(1500).optional().default(""),
  reminder: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid calendar event." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(calendarEvents)
      .values({
        coupleId: auth.couple.id,
        createdById: auth.user.id,
        ...parsed.data,
      })
      .returning();

    emitToCouple(auth.couple.id, "calendar:updated", { event: created }, auth.user.id);

    if (auth.partner) {
      const [notif] = await db
        .insert(notifications)
        .values({
          coupleId: auth.couple.id,
          recipientId: auth.partner.id,
          actorId: auth.user.id,
          kind: "calendar",
          title: "New Shared Date Added 📅",
          body: `${auth.user.displayName} added "${created.title}" on ${created.eventDate}.`,
        })
        .returning();

      emitToCouple(
        auth.couple.id,
        "notification:new",
        { notification: notif },
        auth.user.id
      );
    }

    return NextResponse.json({ event: created }, { status: 201 });
  } catch (err) {
    console.error("Calendar POST error:", err);
    return NextResponse.json(
      { error: "Unable to create calendar event." },
      { status: 500 }
    );
  }
}
