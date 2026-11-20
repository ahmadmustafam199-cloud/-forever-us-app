import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, asc, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  messages,
  messageReactions,
  mediaFiles,
  notifications,
  users,
} from "@/db/schema";
import { getAuthContext, formatUserDTO } from "@/lib/auth";
import { signMediaUrl } from "@/lib/security";
import { emitToCouple, isUserConnectedRealtime } from "@/lib/realtime";

export interface MessageDTO {
  id: string;
  coupleId: string;
  senderId: string;
  messageType: "text" | "sticker" | "image" | "video" | "voice" | "document" | "affection";
  content: string;
  isEncrypted: boolean;
  encryptionIv: string | null;
  stickerId: string | null;
  media: {
    id: string;
    originalName: string;
    mimeType: string;
    category: string;
    sizeBytes: number;
    durationSec: number | null;
    url: string;
    downloadUrl: string;
  } | null;
  replyTo: {
    id: string;
    senderId: string;
    messageType: string;
    content: string;
    isEncrypted: boolean;
    encryptionIv: string | null;
  } | null;
  reactions: Array<{ userId: string; emoji: string }>;
  isForwarded: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  status: "sent" | "delivered" | "read";
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

async function hydrateMessages(
  rows: Array<typeof messages.$inferSelect>,
  coupleId: string
): Promise<MessageDTO[]> {
  if (rows.length === 0) return [];

  const msgIds = rows.map((r) => r.id);
  const mediaIds = rows
    .map((r) => r.mediaId)
    .filter((id): id is string => Boolean(id));
  const replyIds = rows
    .map((r) => r.replyToId)
    .filter((id): id is string => Boolean(id));

  const [reactionRows, mediaRows, replyRows] = await Promise.all([
    db
      .select()
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, msgIds)),
    mediaIds.length > 0
      ? db.select().from(mediaFiles).where(inArray(mediaFiles.id, mediaIds))
      : Promise.resolve([]),
    replyIds.length > 0
      ? db.select().from(messages).where(inArray(messages.id, replyIds))
      : Promise.resolve([]),
  ]);

  const reactionsByMsg = new Map<string, Array<{ userId: string; emoji: string }>>();
  for (const rx of reactionRows) {
    const arr = reactionsByMsg.get(rx.messageId) ?? [];
    arr.push({ userId: rx.userId, emoji: rx.emoji });
    reactionsByMsg.set(rx.messageId, arr);
  }

  const mediaById = new Map(mediaRows.map((m) => [m.id, m]));
  const replyById = new Map(replyRows.map((r) => [r.id, r]));

  return rows.map((r) => {
    const m = r.mediaId ? mediaById.get(r.mediaId) : undefined;
    const rep = r.replyToId ? replyById.get(r.replyToId) : undefined;

    return {
      id: r.id,
      coupleId: r.coupleId,
      senderId: r.senderId,
      messageType: r.messageType as MessageDTO["messageType"],
      content: r.isDeleted ? "This message was deleted" : r.content,
      isEncrypted: r.isDeleted ? false : r.isEncrypted,
      encryptionIv: r.isDeleted ? null : r.encryptionIv,
      stickerId: r.isDeleted ? null : r.stickerId,
      media:
        !r.isDeleted && m
          ? {
              id: m.id,
              originalName: m.originalName,
              mimeType: m.mimeType,
              category: m.category,
              sizeBytes: m.sizeBytes,
              durationSec: m.durationSec,
              url: signMediaUrl(m.id, coupleId),
              downloadUrl: signMediaUrl(m.id, coupleId, { download: true }),
            }
          : null,
      replyTo: rep
        ? {
            id: rep.id,
            senderId: rep.senderId,
            messageType: rep.messageType,
            content: rep.isDeleted ? "Deleted message" : rep.content,
            isEncrypted: rep.isDeleted ? false : rep.isEncrypted,
            encryptionIv: rep.isDeleted ? null : rep.encryptionIv,
          }
        : null,
      reactions: r.isDeleted ? [] : reactionsByMsg.get(r.id) ?? [],
      isForwarded: r.isForwarded,
      isEdited: r.isEdited,
      isDeleted: r.isDeleted,
      status: r.status as MessageDTO["status"],
      deliveredAt: r.deliveredAt ? new Date(r.deliveredAt).toISOString() : null,
      readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    };
  });
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const query = (url.searchParams.get("q") || "").trim().toLowerCase();
    const markRead = url.searchParams.get("markRead") === "1";
    const now = new Date();

    if (markRead) {
      const unreadIncoming = await db
        .update(messages)
        .set({
          status: "read",
          deliveredAt: now,
          readAt: now,
        })
        .where(
          and(
            eq(messages.coupleId, auth.couple.id),
            ne(messages.senderId, auth.user.id),
            ne(messages.status, "read")
          )
        )
        .returning({ id: messages.id });

      if (unreadIncoming.length > 0) {
        emitToCouple(
          auth.couple.id,
          "messages:read",
          {
            messageIds: unreadIncoming.map((m) => m.id),
            readAt: now.toISOString(),
            readerId: auth.user.id,
          },
          auth.user.id
        );
      }
    } else {
      // Mark 'sent' incoming messages as 'delivered'
      const newlyDelivered = await db
        .update(messages)
        .set({ status: "delivered", deliveredAt: now })
        .where(
          and(
            eq(messages.coupleId, auth.couple.id),
            ne(messages.senderId, auth.user.id),
            eq(messages.status, "sent")
          )
        )
        .returning({ id: messages.id });

      if (newlyDelivered.length > 0) {
        emitToCouple(
          auth.couple.id,
          "messages:delivered",
          {
            messageIds: newlyDelivered.map((m) => m.id),
            deliveredAt: now.toISOString(),
          },
          auth.user.id
        );
      }
    }

    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.coupleId, auth.couple.id))
      .orderBy(asc(messages.createdAt));

    let hydrated = await hydrateMessages(rows, auth.couple.id);

    if (query) {
      hydrated = hydrated.filter(
        (m) =>
          !m.isDeleted &&
          (m.content.toLowerCase().includes(query) ||
            (m.media?.originalName.toLowerCase().includes(query) ?? false))
      );
    }

    return NextResponse.json({
      messages: hydrated,
      partner: auth.partner ? formatUserDTO(auth.partner) : null,
    });
  } catch (err) {
    console.error("Messages GET error:", err);
    return NextResponse.json(
      { error: "Failed to load messages." },
      { status: 500 }
    );
  }
}

const sendMessageSchema = z.object({
  messageType: z.enum([
    "text",
    "sticker",
    "image",
    "video",
    "voice",
    "document",
    "affection",
  ]),
  content: z.string().max(8000).default(""),
  isEncrypted: z.boolean().optional().default(false),
  encryptionIv: z.string().max(64).nullable().optional(),
  stickerId: z.string().max(64).nullable().optional(),
  mediaId: z.string().uuid().nullable().optional(),
  replyToId: z.string().uuid().nullable().optional(),
  isForwarded: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple || !auth.couple.husbandId || !auth.couple.wifeId) {
      return NextResponse.json(
        { error: "Connect with your spouse to start chatting." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid message." },
        { status: 400 }
      );
    }

    const d = parsed.data;
    if (d.messageType === "text" && !d.content.trim()) {
      return NextResponse.json(
        { error: "Message text cannot be empty." },
        { status: 400 }
      );
    }

    // Verify media belongs to this couple if attached
    if (d.mediaId) {
      const mRows = await db
        .select()
        .from(mediaFiles)
        .where(
          and(eq(mediaFiles.id, d.mediaId), eq(mediaFiles.coupleId, auth.couple.id))
        )
        .limit(1);
      if (mRows.length === 0) {
        return NextResponse.json({ error: "Invalid attachment." }, { status: 403 });
      }
    }

    const partnerOnline = auth.partner
      ? isUserConnectedRealtime(auth.partner.id) ||
        (auth.partner.isOnline &&
          Date.now() - new Date(auth.partner.lastSeenAt).getTime() < 90_000)
      : false;

    const now = new Date();
    const [inserted] = await db
      .insert(messages)
      .values({
        coupleId: auth.couple.id,
        senderId: auth.user.id,
        messageType: d.messageType,
        content: d.content.trim(),
        isEncrypted: d.isEncrypted,
        encryptionIv: d.encryptionIv ?? null,
        stickerId: d.stickerId ?? null,
        mediaId: d.mediaId ?? null,
        replyToId: d.replyToId ?? null,
        isForwarded: d.isForwarded,
        status: partnerOnline ? "delivered" : "sent",
        deliveredAt: partnerOnline ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Clear sender typing indicator
    await db
      .update(users)
      .set({ typingUntil: null })
      .where(eq(users.id, auth.user.id));

    const [dto] = await hydrateMessages([inserted], auth.couple.id);

    emitToCouple(auth.couple.id, "message:new", { message: dto }, auth.user.id);

    if (auth.partner) {
      const preview = d.isEncrypted
        ? "🔒 End-to-end encrypted message"
        : d.messageType === "image"
        ? "📷 Shared a private photo"
        : d.messageType === "video"
        ? "🎬 Shared a private video"
        : d.messageType === "voice"
        ? "🎙️ Sent a voice message"
        : d.messageType === "document"
        ? `📄 Shared ${dto.media?.originalName || "a document"}`
        : d.messageType === "sticker"
        ? `💖 Sent a sticker: ${d.content || "Love"}`
        : d.content.slice(0, 110);

      const [notif] = await db
        .insert(notifications)
        .values({
          coupleId: auth.couple.id,
          recipientId: auth.partner.id,
          actorId: auth.user.id,
          kind: "message",
          title: auth.user.displayName,
          body: preview,
        })
        .returning();

      emitToCouple(
        auth.couple.id,
        "notification:new",
        { notification: notif },
        auth.user.id
      );
    }

    return NextResponse.json({ message: dto }, { status: 201 });
  } catch (err) {
    console.error("Message POST error:", err);
    return NextResponse.json(
      { error: "Unable to send message." },
      { status: 500 }
    );
  }
}
