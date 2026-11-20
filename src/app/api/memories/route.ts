import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { memories, mediaFiles, notifications } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import { signMediaUrl } from "@/lib/security";
import { emitToCouple } from "@/lib/realtime";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        memory: memories,
        media: mediaFiles,
      })
      .from(memories)
      .innerJoin(mediaFiles, eq(memories.mediaId, mediaFiles.id))
      .where(eq(memories.coupleId, auth.couple.id))
      .orderBy(desc(memories.memoryDate), desc(memories.createdAt));

    const coupleId = auth.couple.id;
    const formatted = rows.map(({ memory, media }) => ({
      id: memory.id,
      uploaderId: memory.uploaderId,
      mediaId: memory.mediaId,
      mediaType: memory.mediaType as "photo" | "video",
      title: memory.title,
      caption: memory.caption,
      album: memory.album,
      memoryDate: memory.memoryDate,
      isFavorite: memory.isFavorite,
      mimeType: media.mimeType,
      originalName: media.originalName,
      sizeBytes: media.sizeBytes,
      url: signMediaUrl(media.id, coupleId),
      downloadUrl: signMediaUrl(media.id, coupleId, { download: true }),
      createdAt: new Date(memory.createdAt).toISOString(),
    }));

    return NextResponse.json({ memories: formatted });
  } catch (err) {
    console.error("Memories GET error:", err);
    return NextResponse.json(
      { error: "Failed to load memories." },
      { status: 500 }
    );
  }
}

const createMemorySchema = z.object({
  mediaId: z.string().uuid(),
  title: z.string().trim().min(1, "Please add a title").max(140),
  caption: z.string().trim().max(2000).default(""),
  album: z.string().trim().min(1).max(80).default("Our Moments"),
  memoryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isFavorite: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth || !auth.couple || !auth.couple.husbandId || !auth.couple.wifeId) {
      return NextResponse.json(
        { error: "Connect with your spouse to create shared memories." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createMemorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid memory details." },
        { status: 400 }
      );
    }

    const mediaRows = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.id, parsed.data.mediaId),
          eq(mediaFiles.coupleId, auth.couple.id)
        )
      )
      .limit(1);

    if (mediaRows.length === 0) {
      return NextResponse.json({ error: "Media file not found." }, { status: 404 });
    }

    const media = mediaRows[0];
    const mediaType = media.mimeType.startsWith("video/") ? "video" : "photo";

    const [created] = await db
      .insert(memories)
      .values({
        coupleId: auth.couple.id,
        uploaderId: auth.user.id,
        mediaId: media.id,
        mediaType,
        title: parsed.data.title,
        caption: parsed.data.caption,
        album: parsed.data.album,
        memoryDate: parsed.data.memoryDate,
        isFavorite: parsed.data.isFavorite,
      })
      .returning();

    const dto = {
      id: created.id,
      uploaderId: created.uploaderId,
      mediaId: created.mediaId,
      mediaType: mediaType as "photo" | "video",
      title: created.title,
      caption: created.caption,
      album: created.album,
      memoryDate: created.memoryDate,
      isFavorite: created.isFavorite,
      mimeType: media.mimeType,
      originalName: media.originalName,
      sizeBytes: media.sizeBytes,
      url: signMediaUrl(media.id, auth.couple.id),
      downloadUrl: signMediaUrl(media.id, auth.couple.id, { download: true }),
      createdAt: new Date(created.createdAt).toISOString(),
    };

    emitToCouple(auth.couple.id, "memory:new", { memory: dto }, auth.user.id);

    if (auth.partner) {
      const [notif] = await db
        .insert(notifications)
        .values({
          coupleId: auth.couple.id,
          recipientId: auth.partner.id,
          actorId: auth.user.id,
          kind: "memory",
          title: `New Shared Memory 📸`,
          body: `${auth.user.displayName} added "${created.title}" to ${created.album}.`,
        })
        .returning();
      emitToCouple(
        auth.couple.id,
        "notification:new",
        { notification: notif },
        auth.user.id
      );
    }

    return NextResponse.json({ memory: dto }, { status: 201 });
  } catch (err) {
    console.error("Memories POST error:", err);
    return NextResponse.json(
      { error: "Unable to save memory." },
      { status: 500 }
    );
  }
}
