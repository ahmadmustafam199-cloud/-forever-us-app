import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { getAuthContext, clearSessionCookie } from "@/lib/auth";
import { hashToken } from "@/lib/security";
import { emitToCouple } from "@/lib/realtime";

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req, { skipPresenceTouch: true });
    if (auth) {
      const tokenHash = hashToken(auth.rawToken);
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
      const now = new Date();
      await db
        .update(users)
        .set({ isOnline: false, lastSeenAt: now, typingUntil: null })
        .where(eq(users.id, auth.user.id));

      if (auth.couple) {
        emitToCouple(
          auth.couple.id,
          "presence",
          {
            userId: auth.user.id,
            isOnline: false,
            lastSeenAt: now.toISOString(),
            isTyping: false,
          },
          auth.user.id
        );
      }
    }

    const res = NextResponse.json({ success: true });
    clearSessionCookie(res);
    return res;
  } catch (err) {
    console.error("Logout error:", err);
    const res = NextResponse.json({ success: true });
    clearSessionCookie(res);
    return res;
  }
}
