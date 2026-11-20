import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { coupleChallenges } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const challengeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().max(1000).optional().default(""),
    category: z.string().trim().max(32).optional().default("Romance"),
    points: z.number().int().min(5).max(200).optional().default(30),
  }),
  z.object({
    action: z.literal("toggle"),
    challengeId: z.string().uuid(),
    isCompleted: z.boolean(),
  }),
  z.object({
    action: z.literal("delete"),
    challengeId: z.string().uuid(),
  }),
]);

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = challengeActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid challenge request." },
        { status: 400 }
      );
    }

    if (parsed.data.action === "create") {
      const [created] = await db
        .insert(coupleChallenges)
        .values({
          coupleId: auth.couple.id,
          title: parsed.data.title,
          description: parsed.data.description,
          category: parsed.data.category,
          points: parsed.data.points,
        })
        .returning();

      emitToCouple(auth.couple.id, "games:updated", {}, auth.user.id);
      return NextResponse.json({ challenge: created }, { status: 201 });
    }

    if (parsed.data.action === "toggle") {
      const [updated] = await db
        .update(coupleChallenges)
        .set({
          isCompleted: parsed.data.isCompleted,
          completedById: parsed.data.isCompleted ? auth.user.id : null,
          completedAt: parsed.data.isCompleted ? new Date() : null,
        })
        .where(
          and(
            eq(coupleChallenges.id, parsed.data.challengeId),
            eq(coupleChallenges.coupleId, auth.couple.id)
          )
        )
        .returning();

      if (!updated) {
        return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
      }

      emitToCouple(auth.couple.id, "games:updated", {}, auth.user.id);
      return NextResponse.json({ challenge: updated });
    }

    await db
      .delete(coupleChallenges)
      .where(
        and(
          eq(coupleChallenges.id, parsed.data.challengeId),
          eq(coupleChallenges.coupleId, auth.couple.id)
        )
      );

    emitToCouple(auth.couple.id, "games:updated", {}, auth.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Challenges POST error:", err);
    return NextResponse.json(
      { error: "Unable to update couple challenges." },
      { status: 500 }
    );
  }
}
