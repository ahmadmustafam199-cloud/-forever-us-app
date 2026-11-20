import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { couples } from "@/db/schema";
import { getAuthContext, formatCoupleDTO } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const coupleSettingsSchema = z.object({
  coupleName: z.string().trim().min(2).max(100).optional(),
  anniversaryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format")
    .optional(),
  relationshipStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format")
    .optional(),
  e2eeEnabled: z.boolean().optional(),
  dailyQuoteIndex: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = coupleSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid settings." },
        { status: 400 }
      );
    }

    const updates: Partial<typeof couples.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (parsed.data.coupleName !== undefined) updates.coupleName = parsed.data.coupleName;
    if (parsed.data.anniversaryDate !== undefined) {
      updates.anniversaryDate = parsed.data.anniversaryDate;
    }
    if (parsed.data.relationshipStartDate !== undefined) {
      updates.relationshipStartDate = parsed.data.relationshipStartDate;
    }
    if (parsed.data.e2eeEnabled !== undefined) updates.e2eeEnabled = parsed.data.e2eeEnabled;
    if (parsed.data.dailyQuoteIndex !== undefined) {
      updates.dailyQuoteIndex = parsed.data.dailyQuoteIndex;
    }

    const [updated] = await db
      .update(couples)
      .set(updates)
      .where(eq(couples.id, auth.couple.id))
      .returning();

    const dto = formatCoupleDTO(updated);
    emitToCouple(auth.couple.id, "couple:updated", { couple: dto }, auth.user.id);

    return NextResponse.json({ couple: dto });
  } catch (err) {
    console.error("Couple settings error:", err);
    return NextResponse.json(
      { error: "Unable to save couple settings." },
      { status: 500 }
    );
  }
}
