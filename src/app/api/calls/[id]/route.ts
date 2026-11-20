import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { callLogs } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const updateCallSchema = z.object({
  action: z.enum(["accept", "reject", "end"]),
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
    const parsed = updateCallSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid call action." }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.id, id), eq(callLogs.coupleId, auth.couple.id)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Call not found." }, { status: 404 });
    }

    const existing = rows[0];
    const now = new Date();
    let updates: Partial<typeof callLogs.$inferInsert> = {};

    if (parsed.data.action === "accept") {
      updates = {
        status: "active",
        answeredAt: existing.answeredAt ?? now,
      };
    } else if (parsed.data.action === "reject") {
      updates = {
        status: "rejected",
        endedAt: now,
        durationSec: 0,
      };
    } else {
      if (existing.answeredAt) {
        const dur = Math.max(
          1,
          Math.round((now.getTime() - new Date(existing.answeredAt).getTime()) / 1000)
        );
        updates = {
          status: "ended",
          endedAt: now,
          durationSec: dur,
        };
      } else {
        updates = {
          status: "missed",
          endedAt: now,
          durationSec: 0,
        };
      }
    }

    const [updated] = await db
      .update(callLogs)
      .set(updates)
      .where(eq(callLogs.id, id))
      .returning();

    emitToCouple(auth.couple.id, "call:updated", {
      call: updated,
      actorId: auth.user.id,
    });

    return NextResponse.json({ call: updated });
  } catch (err) {
    console.error("Call PATCH error:", err);
    return NextResponse.json(
      { error: "Unable to update call." },
      { status: 500 }
    );
  }
}
