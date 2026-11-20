import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { couples, users, mediaFiles, notifications } from "@/db/schema";
import {
  getAuthContext,
  formatCoupleDTO,
  formatUserDTO,
} from "@/lib/auth";
import { generateInviteCode } from "@/lib/security";
import { initializeNewCoupleContent } from "@/lib/seed";
import { emitToUser } from "@/lib/realtime";

const connectSchema = z.object({
  inviteCode: z.string().trim().min(4, "Please enter a valid invitation code").max(24),
});

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (auth.couple && auth.couple.husbandId && auth.couple.wifeId) {
      return NextResponse.json(
        { error: "You are already connected to your spouse in a private sanctuary." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a valid private invitation code." },
        { status: 400 }
      );
    }

    const code = parsed.data.inviteCode.toUpperCase();
    const targetRows = await db
      .select()
      .from(couples)
      .where(eq(couples.inviteCode, code))
      .limit(1);

    if (targetRows.length === 0) {
      return NextResponse.json(
        { error: "Invitation code not found. Double-check the code from your spouse." },
        { status: 404 }
      );
    }

    const target = targetRows[0];

    if (target.id === auth.couple?.id) {
      return NextResponse.json(
        { error: "That is your own invitation code! Share it with your spouse to connect." },
        { status: 400 }
      );
    }

    // Strict 2-authorized-users rule
    if (target.husbandId && target.wifeId) {
      return NextResponse.json(
        {
          error:
            "Access denied: This private couple space is permanently locked to its two spouses.",
        },
        { status: 403 }
      );
    }

    if (new Date(target.inviteExpiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This invitation code has expired. Ask your spouse to generate a fresh code." },
        { status: 410 }
      );
    }

    if (auth.user.role === "husband" && target.husbandId) {
      return NextResponse.json(
        {
          error:
            "This sanctuary already has a Husband account. Only the Wife account can join with this code.",
        },
        { status: 403 }
      );
    }
    if (auth.user.role === "wife" && target.wifeId) {
      return NextResponse.json(
        {
          error:
            "This sanctuary already has a Wife account. Only the Husband account can join with this code.",
        },
        { status: 403 }
      );
    }

    const partnerId = target.husbandId ?? target.wifeId;
    if (!partnerId) {
      return NextResponse.json({ error: "Invalid invitation state." }, { status: 400 });
    }

    const [partner] = await db
      .select()
      .from(users)
      .where(eq(users.id, partnerId))
      .limit(1);

    const husbandId = auth.user.role === "husband" ? auth.user.id : partnerId;
    const wifeId = auth.user.role === "wife" ? auth.user.id : partnerId;

    const husbandName =
      auth.user.role === "husband"
        ? auth.user.displayName.split(" ")[0]
        : partner?.displayName.split(" ")[0] || "Husband";
    const wifeName =
      auth.user.role === "wife"
        ? auth.user.displayName.split(" ")[0]
        : partner?.displayName.split(" ")[0] || "Wife";

    const previousCoupleId = auth.user.coupleId;

    // First point caller to target couple & remove their unused solo placeholder couple
    // so the unique constraint on husband_id / wife_id is released cleanly
    const [updatedUser] = await db
      .update(users)
      .set({ coupleId: target.id })
      .where(eq(users.id, auth.user.id))
      .returning();

    if (previousCoupleId && previousCoupleId !== target.id) {
      // Preserve any avatar uploaded before pairing by moving it to target couple first
      if (updatedUser.avatarMediaId) {
        await db
          .update(mediaFiles)
          .set({ coupleId: target.id })
          .where(eq(mediaFiles.id, updatedUser.avatarMediaId));
      }
      await db.delete(couples).where(eq(couples.id, previousCoupleId));
    }

    // Connect both spouses & rotate invite code so it can never be reused
    const [connectedCouple] = await db
      .update(couples)
      .set({
        husbandId,
        wifeId,
        coupleName: `${husbandName} & ${wifeName}`,
        inviteCode: generateInviteCode(),
        inviteExpiresAt: new Date(0),
        updatedAt: new Date(),
      })
      .where(eq(couples.id, target.id))
      .returning();

    if (partner?.avatarMediaId) {
      await db
        .update(mediaFiles)
        .set({ coupleId: connectedCouple.id })
        .where(eq(mediaFiles.id, partner.avatarMediaId));
    }

    // Seed starter romantic content for the newly paired couple
    await initializeNewCoupleContent(
      connectedCouple.id,
      husbandId,
      wifeId,
      connectedCouple.anniversaryDate
    );

    // Notify waiting partner in real time
    await db.insert(notifications).values({
      coupleId: connectedCouple.id,
      recipientId: partnerId,
      actorId: updatedUser.id,
      kind: "partner_joined",
      title: `${updatedUser.displayName} connected! ❤️`,
      body: "Your private Forever Us sanctuary is now active and locked exclusively to the two of you.",
    });

    emitToUser(partnerId, "couple:connected", {
      couple: formatCoupleDTO(connectedCouple),
      partner: formatUserDTO(updatedUser),
    });

    return NextResponse.json({
      user: formatUserDTO(updatedUser),
      couple: formatCoupleDTO(connectedCouple),
      partner: partner ? formatUserDTO(partner) : null,
    });
  } catch (err) {
    console.error("Couple connect error:", err);
    return NextResponse.json(
      { error: "Unable to connect partner right now." },
      { status: 500 }
    );
  }
}
