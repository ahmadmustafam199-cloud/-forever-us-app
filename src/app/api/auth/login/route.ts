import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, couples } from "@/db/schema";
import {
  createUserSession,
  attachSessionCookie,
  formatUserDTO,
  formatCoupleDTO,
} from "@/lib/auth";
import { ensureDemoSeed } from "@/lib/seed";
import { emitToCouple } from "@/lib/realtime";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
  deviceLabel: z.string().trim().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    await ensureDemoSeed();
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid login credentials." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const found = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (found.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const user = found[0];
    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const sessionToken = await createUserSession(
      user.id,
      parsed.data.deviceLabel || "Forever Us Android"
    );

    const updatedUser = { ...user, isOnline: true, lastSeenAt: new Date() };
    let coupleDto = null;
    let partnerDto = null;

    if (updatedUser.coupleId) {
      const coupleRows = await db
        .select()
        .from(couples)
        .where(eq(couples.id, updatedUser.coupleId))
        .limit(1);

      if (coupleRows.length > 0) {
        const c = coupleRows[0];
        if (c.husbandId === updatedUser.id || c.wifeId === updatedUser.id) {
          coupleDto = formatCoupleDTO(c);
          const partnerId = c.husbandId === updatedUser.id ? c.wifeId : c.husbandId;
          if (partnerId) {
            const pRows = await db
              .select()
              .from(users)
              .where(eq(users.id, partnerId))
              .limit(1);
            if (pRows.length > 0) {
              partnerDto = formatUserDTO(pRows[0]);
            }
          }
          emitToCouple(
            c.id,
            "presence",
            { userId: updatedUser.id, isOnline: true, lastSeenAt: new Date().toISOString() },
            updatedUser.id
          );
        }
      }
    }

    const res = NextResponse.json({
      user: formatUserDTO(updatedUser),
      couple: coupleDto,
      partner: partnerDto,
      sessionToken,
    });
    attachSessionCookie(res, sessionToken);
    return res;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Unable to sign in right now." },
      { status: 500 }
    );
  }
}
