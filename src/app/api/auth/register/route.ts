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
import { generateInviteCode, generateE2eeSalt } from "@/lib/security";
import { ensureDemoSeed } from "@/lib/seed";

const registerSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().email("Please enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  role: z.enum(["husband", "wife"]),
  inviteCode: z.string().trim().max(24).optional(),
  deviceLabel: z.string().trim().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    await ensureDemoSeed();
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid registration details." },
        { status: 400 }
      );
    }

    const { displayName, password, role, deviceLabel } = parsed.data;
    const email = parsed.data.email.toLowerCase();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create a fresh pending couple sanctuary with a private invitation code
    const inviteCode = generateInviteCode();
    const [newCouple] = await db
      .insert(couples)
      .values({
        coupleName: `${displayName.split(" ")[0]}'s Forever Us`,
        inviteCode,
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        e2eeSalt: generateE2eeSalt(),
        anniversaryDate: new Date().toISOString().slice(0, 10),
        relationshipStartDate: new Date().toISOString().slice(0, 10),
      })
      .returning();

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        role,
        bio:
          role === "husband"
            ? "Dedicated husband — two hearts, one private world ❤️"
            : "Devoted wife — two hearts, one private world 🌹",
        coupleId: newCouple.id,
        isOnline: true,
        lastSeenAt: new Date(),
      })
      .returning();

    const [updatedCouple] = await db
      .update(couples)
      .set(role === "husband" ? { husbandId: user.id } : { wifeId: user.id })
      .where(eq(couples.id, newCouple.id))
      .returning();

    const sessionToken = await createUserSession(
      user.id,
      deviceLabel || "Forever Us Android"
    );

    const res = NextResponse.json(
      {
        user: formatUserDTO(user),
        couple: formatCoupleDTO(updatedCouple),
        partner: null,
        sessionToken,
      },
      { status: 201 }
    );
    attachSessionCookie(res, sessionToken);
    return res;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Unable to create account right now." },
      { status: 500 }
    );
  }
}
