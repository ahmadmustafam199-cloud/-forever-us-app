import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { affections, coupleQuestions } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { DAILY_ROMANTIC_MESSAGES } from "@/lib/romantic-data";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [affRows, qRows] = await Promise.all([
      db
        .select()
        .from(affections)
        .where(eq(affections.coupleId, auth.couple.id))
        .orderBy(desc(affections.createdAt)),
      db
        .select()
        .from(coupleQuestions)
        .where(eq(coupleQuestions.coupleId, auth.couple.id))
        .orderBy(desc(coupleQuestions.createdAt)),
    ]);

    const stats = {
      roses: 0,
      kisses: 0,
      hugs: 0,
      sparkles: 0,
      surprises: 0,
    };

    for (const a of affRows) {
      if (a.kind === "rose") stats.roses++;
      else if (a.kind === "kiss") stats.kisses++;
      else if (a.kind === "hug") stats.hugs++;
      else if (a.kind === "sparkle") stats.sparkles++;
      else if (a.kind === "surprise") stats.surprises++;
    }

    const now = Date.now();
    const surprises = affRows
      .filter((a) => a.kind === "surprise")
      .map((s) => {
        const isSender = s.senderId === auth.user.id;
        const lockedByTime = s.unlockAt ? new Date(s.unlockAt).getTime() > now : false;
        const canReadNote = isSender || (s.isOpened && !lockedByTime);
        return {
          id: s.id,
          senderId: s.senderId,
          title: s.title || "Special Surprise Love Letter",
          note: canReadNote ? s.note : "",
          unlockAt: s.unlockAt ? new Date(s.unlockAt).toISOString() : null,
          isLockedByTime: lockedByTime,
          isOpened: s.isOpened,
          openedAt: s.openedAt ? new Date(s.openedAt).toISOString() : null,
          createdAt: new Date(s.createdAt).toISOString(),
        };
      });

    const recentAffections = affRows
      .filter((a) => a.kind !== "surprise")
      .slice(0, 20)
      .map((a) => ({
        id: a.id,
        senderId: a.senderId,
        kind: a.kind as "rose" | "kiss" | "hug" | "sparkle",
        title: a.title,
        note: a.note,
        createdAt: new Date(a.createdAt).toISOString(),
      }));

    const daySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
    const quoteIdx =
      (daySeed + (auth.couple.dailyQuoteIndex || 0)) %
      DAILY_ROMANTIC_MESSAGES.length;

    return NextResponse.json({
      dailyQuote: DAILY_ROMANTIC_MESSAGES[quoteIdx],
      allQuotesCount: DAILY_ROMANTIC_MESSAGES.length,
      stats,
      recentAffections,
      surprises,
      questions: qRows.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        category: q.category,
        husbandAnswer: q.husbandAnswer,
        wifeAnswer: q.wifeAnswer,
        createdAt: new Date(q.createdAt).toISOString(),
      })),
    });
  } catch (err) {
    console.error("Love zone GET error:", err);
    return NextResponse.json(
      { error: "Unable to load Love Zone." },
      { status: 500 }
    );
  }
}
