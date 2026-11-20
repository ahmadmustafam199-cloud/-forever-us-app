import { NextResponse } from "next/server";
import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import {
  MediaCategory,
  validateAndStorePrivateFile,
  signMediaUrl,
} from "@/lib/security";

const VALID_CATEGORIES: MediaCategory[] = [
  "image",
  "video",
  "audio",
  "document",
  "avatar",
];

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const rawCategory = String(formData.get("category") || "image") as MediaCategory;
    const rawDuration = formData.get("durationSec");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(rawCategory)) {
      return NextResponse.json({ error: "Invalid file category." }, { status: 400 });
    }

    if (rawCategory !== "avatar" && (!auth.couple || !auth.couple.husbandId || !auth.couple.wifeId)) {
      return NextResponse.json(
        { error: "Connect with your spouse first before sharing private media." },
        { status: 403 }
      );
    }

    const stored = await validateAndStorePrivateFile(file, rawCategory);
    const durationSec =
      rawDuration !== null && Number.isFinite(Number(rawDuration))
        ? Math.max(0, Math.round(Number(rawDuration)))
        : null;

    const coupleId = auth.couple ? auth.couple.id : null;

    const [record] = await db
      .insert(mediaFiles)
      .values({
        coupleId,
        uploaderId: auth.user.id,
        storagePath: stored.storagePath,
        originalName: stored.originalName,
        mimeType: stored.mimeType,
        category: rawCategory,
        sizeBytes: stored.sizeBytes,
        durationSec,
      })
      .returning();

    const scopeId = coupleId ?? auth.user.id;

    return NextResponse.json(
      {
        media: {
          id: record.id,
          originalName: record.originalName,
          mimeType: record.mimeType,
          category: record.category,
          sizeBytes: record.sizeBytes,
          durationSec: record.durationSec,
          url: signMediaUrl(record.id, scopeId),
          downloadUrl: signMediaUrl(record.id, scopeId, { download: true }),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to validate and upload file.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
