import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { couples, users } from "@/db/schema";
import { getAuthContext, formatCoupleDTO } from "@/lib/auth";
import { generateInviteCode, generateE2eeSalt } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (auth.couple && auth.couple.husbandId && auth.couple.wifeId) {
      return NextResponse.json(
        {
          error:
            "Your couple sanctuary already has two authorized spouses connected. No additional invites can be generated.",
        },
        { status: 403 }
      );
    }

    const newCode = generateInviteCode();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (auth.couple) {
      const [updated] = await db
        .update(couples)
        .set({ inviteCode: newCode, inviteExpiresAt: expiresAt, updatedAt: new Date() })
        .where(eq(couples.id, auth.couple.id))
        .returning();
      return NextResponse.json({ couple: formatCoupleDTO(updated) });
    }

    const [created] = await db
      .insert(couples)
      .values({
        coupleName: `${auth.user.displayName.split(" ")[0]}'s Forever Us`,
        inviteCode: newCode,
        inviteExpiresAt: expiresAt,
        husbandId: auth.user.role === "husband" ? auth.user.id : null,
        wifeId: auth.user.role === "wife" ? auth.user.id : null,
        e2eeSalt: generateE2eeSalt(),
      })
      .returning();

    await db
      .update(users)
      .set({ coupleId: created.id })
      .where(eq(users.id, auth.user.id));

    return NextResponse.json({ couple: formatCoupleDTO(created) });
  } catch (err) {
    console.error("Couple invite error:", err);
    return NextResponse.json(
      { error: "Unable to generate invitation code." },
      { status: 500 }
    );
  }
}
