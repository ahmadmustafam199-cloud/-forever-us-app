import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, ne, count } from "drizzle-orm";
import { db } from "@/db";
import { users, notifications, messages, mediaFiles } from "@/db/schema";
import {
  getAuthContext,
  formatUserDTO,
  formatCoupleDTO,
} from "@/lib/auth";
import { ensureDemoSeed } from "@/lib/seed";
import { emitToCouple } from "@/lib/realtime";

export async function GET(req: Request) {
  try {
    await ensureDemoSeed();
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ user: null, couple: null, partner: null });
    }

    let unreadNotifications = 0;
    let unreadMessages = 0;

    if (auth.couple) {
      const [notifCount] = await db
        .select({ value: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientId, auth.user.id),
            eq(notifications.isRead, false)
          )
        );
      unreadNotifications = Number(notifCount?.value ?? 0);

      const [msgCount] = await db
        .select({ value: count() })
        .from(messages)
        .where(
          and(
            eq(messages.coupleId, auth.couple.id),
            ne(messages.senderId, auth.user.id),
            ne(messages.status, "read"),
            eq(messages.isDeleted, false)
          )
        );
      unreadMessages = Number(msgCount?.value ?? 0);
    }

    return NextResponse.json({
      user: formatUserDTO(auth.user),
      couple: auth.couple ? formatCoupleDTO(auth.couple) : null,
      partner: auth.partner ? formatUserDTO(auth.partner) : null,
      unreadNotifications,
      unreadMessages,
    });
  } catch (err) {
    console.error("Auth me GET error:", err);
    return NextResponse.json(
      { error: "Failed to load session." },
      { status: 500 }
    );
  }
}

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(240).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  notificationsEnabled: z.boolean().optional(),
  avatarMediaId: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid profile update." },
        { status: 400 }
      );
    }

    const updates: Partial<typeof users.$inferInsert> = {};
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
    if (parsed.data.theme !== undefined) updates.theme = parsed.data.theme;
    if (parsed.data.notificationsEnabled !== undefined) {
      updates.notificationsEnabled = parsed.data.notificationsEnabled;
    }

    if (parsed.data.avatarMediaId !== undefined) {
      if (parsed.data.avatarMediaId === null) {
        updates.avatarMediaId = null;
      } else {
        const mediaRows = await db
          .select()
          .from(mediaFiles)
          .where(eq(mediaFiles.id, parsed.data.avatarMediaId))
          .limit(1);
        if (mediaRows.length === 0 || mediaRows[0].uploaderId !== auth.user.id) {
          return NextResponse.json({ error: "Invalid avatar image." }, { status: 403 });
        }
        updates.avatarMediaId = parsed.data.avatarMediaId;
      }
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, auth.user.id))
      .returning();

    const userDto = formatUserDTO(updated);

    if (auth.couple) {
      emitToCouple(auth.couple.id, "partner:updated", { partner: userDto }, auth.user.id);
    }

    return NextResponse.json({ user: userDto });
  } catch (err) {
    console.error("Auth me PATCH error:", err);
    return NextResponse.json(
      { error: "Unable to update profile." },
      { status: 500 }
    );
  }
}
