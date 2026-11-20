import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { affections, messages, notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { emitToCouple } from "@/lib/realtime";

const affectionSchema = z.object({
  kind: z.enum(["rose", "kiss", "hug", "sparkle", "surprise"]),
  title: z.string().trim().max(140).optional().default(""),
  note: z.string().trim().max(3000).optional().default(""),
  unlockAt: z.string().datetime().nullable().optional(),
  sendToChat: z.boolean().optional().default(true),
});

const KIND_META: Record<
  string,
  { emoji: string; defaultTitle: string; defaultNote: string }
> = {
  rose: {
    emoji: "🌹",
    defaultTitle: "Sent a Velvet Red Rose",
    defaultNote: "Thinking of you and sending a fresh bloom of love 🌹",
  },
  kiss: {
    emoji: "💋",
    defaultTitle: "Sent a Sweet Kiss",
    defaultNote: "Blowing a thousand warm kisses straight to your heart 💋",
  },
  hug: {
    emoji: "🫂",
    defaultTitle: "Sent a Warm Embrace",
    defaultNote: "Wrapping my arms tight around you from wherever I am 🫂",
  },
  sparkle: {
    emoji: "💖",
    defaultTitle: "Sent a Shower of Hearts",
    defaultNote: "You still give me butterflies every single day 💖✨",
  },
  surprise: {
    emoji: "🎁",
    defaultTitle: "A Sealed Surprise Just For You",
    defaultNote: "Every moment with you is my favorite memory in the making ❤️",
  },
};

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple || !auth.partner) {
      return NextResponse.json(
        { error: "Connect with your spouse first." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = affectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid affection." },
        { status: 400 }
      );
    }

    const { kind, unlockAt, sendToChat } = parsed.data;
    const meta = KIND_META[kind];
    const title = parsed.data.title || meta.defaultTitle;
    const note = parsed.data.note || meta.defaultNote;

    if (kind === "surprise" && !parsed.data.note.trim()) {
      return NextResponse.json(
        { error: "Write a romantic surprise message for your spouse first." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(affections)
      .values({
        coupleId: auth.couple.id,
        senderId: auth.user.id,
        kind,
        title,
        note,
        unlockAt: unlockAt ? new Date(unlockAt) : null,
        isOpened: kind !== "surprise",
        openedAt: kind !== "surprise" ? new Date() : null,
      })
      .returning();

    // Live floating hearts/roses/kisses animation on partner's screen!
    emitToCouple(
      auth.couple.id,
      "affection:burst",
      {
        id: created.id,
        senderId: auth.user.id,
        senderName: auth.user.displayName,
        kind,
        emoji: meta.emoji,
        title,
        note: kind === "surprise" ? "Tap to unwrap in Love Zone 🎁" : note,
      },
      auth.user.id
    );

    if (sendToChat && kind !== "surprise") {
      const [chatMsg] = await db
        .insert(messages)
        .values({
          coupleId: auth.couple.id,
          senderId: auth.user.id,
          messageType: "affection",
          content: `${meta.emoji} ${title} — ${note}`,
          status: "delivered",
          deliveredAt: new Date(),
        })
        .returning();

      emitToCouple(
        auth.couple.id,
        "message:new",
        {
          message: {
            ...chatMsg,
            media: null,
            replyTo: null,
            reactions: [],
            deliveredAt: chatMsg.deliveredAt?.toISOString() ?? null,
            readAt: null,
            createdAt: chatMsg.createdAt.toISOString(),
            updatedAt: chatMsg.updatedAt.toISOString(),
          },
        },
        auth.user.id
      );
    }

    const [notif] = await db
      .insert(notifications)
      .values({
        coupleId: auth.couple.id,
        recipientId: auth.partner.id,
        actorId: auth.user.id,
        kind: "affection",
        title: `${auth.user.displayName} ${meta.emoji}`,
        body: kind === "surprise" ? `Sent a sealed surprise: "${title}"` : note,
      })
      .returning();

    emitToCouple(
      auth.couple.id,
      "notification:new",
      { notification: notif },
      auth.user.id
    );

    return NextResponse.json({ affection: created }, { status: 201 });
  } catch (err) {
    console.error("Affection POST error:", err);
    return NextResponse.json(
      { error: "Unable to send affection." },
      { status: 500 }
    );
  }
}
