import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { quizQuestions, coupleChallenges } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { TRUTH_OR_DARE_DECK } from "@/lib/romantic-data";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [quizRows, challengeRows] = await Promise.all([
      db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.coupleId, auth.couple.id))
        .orderBy(desc(quizQuestions.createdAt)),
      db
        .select()
        .from(coupleChallenges)
        .where(eq(coupleChallenges.coupleId, auth.couple.id))
        .orderBy(desc(coupleChallenges.createdAt)),
    ]);

    let answeredCount = 0;
    let correctCount = 0;

    const quizzes = quizRows.map((q) => {
      const isAnswered = q.partnerGuessIndex !== null;
      const isAuthor = q.authorId === auth.user.id;
      if (isAnswered) {
        answeredCount++;
        if (q.partnerGuessIndex === q.correctIndex) correctCount++;
      }
      let options: string[] = [];
      try {
        options = JSON.parse(q.optionsJson);
      } catch {
        options = [];
      }
      return {
        id: q.id,
        authorId: q.authorId,
        question: q.question,
        options,
        // Only reveal correct answer to author or once guessed!
        correctIndex: isAuthor || isAnswered ? q.correctIndex : null,
        partnerGuessIndex: q.partnerGuessIndex,
        answeredAt: q.answeredAt ? new Date(q.answeredAt).toISOString() : null,
        createdAt: new Date(q.createdAt).toISOString(),
      };
    });

    const syncScore =
      answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 100;

    const earnedPoints = challengeRows
      .filter((c) => c.isCompleted)
      .reduce((sum, c) => sum + c.points, 0) + correctCount * 20;

    return NextResponse.json({
      quizzes,
      quizStats: {
        total: quizRows.length,
        answered: answeredCount,
        correct: correctCount,
        syncScore,
      },
      challenges: challengeRows.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        points: c.points,
        isCompleted: c.isCompleted,
        completedById: c.completedById,
        completedAt: c.completedAt ? new Date(c.completedAt).toISOString() : null,
        createdAt: new Date(c.createdAt).toISOString(),
      })),
      earnedPoints,
      truthOrDareDeck: TRUTH_OR_DARE_DECK,
    });
  } catch (err) {
    console.error("Games GET error:", err);
    return NextResponse.json(
      { error: "Unable to load Couple Games." },
      { status: 500 }
    );
  }
}
