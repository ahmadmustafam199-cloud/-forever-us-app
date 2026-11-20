import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const isTyping = Boolean(body?.isTyping);
    const typingUntil = isTyping ? new Date(Date.now() + 5000) : null;

    await db
      .update(users)
      .set({ typingUntil, isOnline: true, lastSeenAt: new Date() })
      .where(eq(users.id, auth.user.id));

    emitToCouple(
      auth.couple.id,
      "typing",
      { userId: auth.user.id, isTyping },
      auth.user.id
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
