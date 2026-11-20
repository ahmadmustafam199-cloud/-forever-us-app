import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { quizQuestions, notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const quizActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    question: z.string().trim().min(5).max(300),
    options: z.array(z.string().trim().min(1).max(120)).length(4),
    correctIndex: z.number().int().min(0).max(3),
  }),
  z.object({
    action: z.literal("guess"),
    quizId: z.string().uuid(),
    guessIndex: z.number().int().min(0).max(3),
  }),
]);

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = quizActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid quiz submission." },
        { status: 400 }
      );
    }

    if (parsed.data.action === "create") {
      const [created] = await db
        .insert(quizQuestions)
        .values({
          coupleId: auth.couple.id,
          authorId: auth.user.id,
          question: parsed.data.question,
          optionsJson: JSON.stringify(parsed.data.options),
          correctIndex: parsed.data.correctIndex,
        })
        .returning();

      emitToCouple(auth.couple.id, "games:updated", {}, auth.user.id);

      if (auth.partner) {
        await db.insert(notifications).values({
          coupleId: auth.couple.id,
          recipientId: auth.partner.id,
          actorId: auth.user.id,
          kind: "game",
          title: "New Love Quiz Challenge 💘",
          body: `${auth.user.displayName} wrote a new quiz question for you!`,
        });
      }

      return NextResponse.json({ quiz: created }, { status: 201 });
    }

    // Submit partner guess
    const rows = await db
      .select()
      .from(quizQuestions)
      .where(
        and(
          eq(quizQuestions.id, parsed.data.quizId),
          eq(quizQuestions.coupleId, auth.couple.id)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Quiz question not found." }, { status: 404 });
    }

    const q = rows[0];
    if (q.authorId === auth.user.id) {
      return NextResponse.json(
        { error: "This question is for your spouse to guess!" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(quizQuestions)
      .set({
        partnerGuessIndex: parsed.data.guessIndex,
        answeredAt: new Date(),
      })
      .where(eq(quizQuestions.id, q.id))
      .returning();

    const isCorrect = updated.partnerGuessIndex === updated.correctIndex;
    emitToCouple(auth.couple.id, "games:updated", {}, auth.user.id);

    if (auth.partner) {
      await db.insert(notifications).values({
        coupleId: auth.couple.id,
        recipientId: auth.partner.id,
        actorId: auth.user.id,
        kind: "game",
        title: isCorrect ? "Soulmate Match! 🎉❤️" : "Love Quiz Answered 💕",
        body: `${auth.user.displayName} ${
          isCorrect ? "nailed" : "guessed"
        } your quiz question!`,
      });
    }

    return NextResponse.json({
      isCorrect,
      correctIndex: updated.correctIndex,
      partnerGuessIndex: updated.partnerGuessIndex,
    });
  } catch (err) {
    console.error("Quiz POST error:", err);
    return NextResponse.json(
      { error: "Unable to save quiz action." },
      { status: 500 }
    );
  }
}
