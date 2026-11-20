import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { coupleQuestions, notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { ROMANTIC_QUESTION_DECK } from "@/lib/romantic-data";
import { emitToCouple } from "@/lib/realtime";

const questionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("draw_random"),
  }),
  z.object({
    action: z.literal("custom"),
    prompt: z.string().trim().min(5).max(500),
    category: z.string().trim().max(40).optional().default("Heart to Heart"),
  }),
  z.object({
    action: z.literal("answer"),
    questionId: z.string().uuid(),
    answer: z.string().trim().min(1).max(2000),
  }),
]);

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = questionActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid question action." }, { status: 400 });
    }

    if (parsed.data.action === "draw_random") {
      const existing = await db
        .select({ prompt: coupleQuestions.prompt })
        .from(coupleQuestions)
        .where(eq(coupleQuestions.coupleId, auth.couple.id));
      const used = new Set(existing.map((e) => e.prompt));
      const available = ROMANTIC_QUESTION_DECK.filter((q) => !used.has(q.prompt));
      const pool = available.length > 0 ? available : ROMANTIC_QUESTION_DECK;
      const chosen = pool[Math.floor(Math.random() * pool.length)];

      const [created] = await db
        .insert(coupleQuestions)
        .values({
          coupleId: auth.couple.id,
          prompt: chosen.prompt,
          category: chosen.category,
        })
        .returning();

      emitToCouple(auth.couple.id, "lovezone:updated", { question: created }, auth.user.id);
      return NextResponse.json({ question: created }, { status: 201 });
    }

    if (parsed.data.action === "custom") {
      const [created] = await db
        .insert(coupleQuestions)
        .values({
          coupleId: auth.couple.id,
          prompt: parsed.data.prompt,
          category: parsed.data.category,
        })
        .returning();

      emitToCouple(auth.couple.id, "lovezone:updated", { question: created }, auth.user.id);
      return NextResponse.json({ question: created }, { status: 201 });
    }

    // Answer an existing question
    const updates =
      auth.user.role === "husband"
        ? { husbandAnswer: parsed.data.answer, updatedAt: new Date() }
        : { wifeAnswer: parsed.data.answer, updatedAt: new Date() };

    const [updated] = await db
      .update(coupleQuestions)
      .set(updates)
      .where(
        and(
          eq(coupleQuestions.id, parsed.data.questionId),
          eq(coupleQuestions.coupleId, auth.couple.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    emitToCouple(auth.couple.id, "lovezone:updated", { question: updated }, auth.user.id);

    if (auth.partner) {
      await db.insert(notifications).values({
        coupleId: auth.couple.id,
        recipientId: auth.partner.id,
        actorId: auth.user.id,
        kind: "game",
        title: "Romantic Question Answered 💭",
        body: `${auth.user.displayName} answered: "${updated.prompt.slice(0, 70)}..."`,
      });
    }

    return NextResponse.json({ question: updated });
  } catch (err) {
    console.error("Questions POST error:", err);
    return NextResponse.json(
      { error: "Unable to process romantic question." },
      { status: 500 }
    );
  }
}
