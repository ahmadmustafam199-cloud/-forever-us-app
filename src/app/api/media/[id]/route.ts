import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaFiles } from "@/db/schema";
import { getAuthContext } from "@/lib/auth";
import {
  PRIVATE_UPLOAD_DIR,
  SEED_MEDIA_DIR,
  verifyMediaSignature,
  sanitizeFilename,
} from "@/lib/security";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      return NextResponse.json({ error: "Invalid media identifier." }, { status: 400 });
    }

    const rows = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Private media not found." }, { status: 404 });
    }

    const media = rows[0];
    const url = new URL(req.url);
    const scopeParam = url.searchParams.get("scope") || "";
    const expParam = url.searchParams.get("exp");
    const sigParam = url.searchParams.get("sig");
    const wantDownload = url.searchParams.get("download") === "1";

    // Strict private media access gate:
    // Must either hold a valid, non-expired HMAC token scoped strictly to this couple/uploader
    // OR hold a valid authenticated session belonging to one of the two authorized spouses.
    const expectedScope = media.coupleId ?? media.uploaderId;
    let authorized = false;

    if (
      scopeParam === expectedScope &&
      verifyMediaSignature(media.id, expectedScope, expParam, sigParam)
    ) {
      authorized = true;
    } else {
      const auth = await getAuthContext(req, { skipPresenceTouch: true });
      if (auth) {
        if (media.coupleId && auth.couple?.id === media.coupleId) {
          authorized = true;
        } else if (!media.coupleId && auth.user.id === media.uploaderId) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Unauthorized: Private couple media is strictly protected." },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    let filePath: string;
    if (media.storagePath.startsWith("seed:")) {
      const seedName = path.basename(media.storagePath.slice(5));
      filePath = path.join(SEED_MEDIA_DIR, seedName);
    } else {
      const safeFile = path.basename(media.storagePath);
      filePath = path.join(PRIVATE_UPLOAD_DIR, safeFile);
    }

    const buffer = await fs.readFile(filePath);
    const totalLength = buffer.length;
    const safeName = sanitizeFilename(media.originalName);

    const baseHeaders: Record<string, string> = {
      "Content-Type": media.mimeType,
      "Cache-Control": "private, max-age=300, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; media-src 'self'; img-src 'self'",
      "Accept-Ranges": "bytes",
      "Content-Disposition": wantDownload
        ? `attachment; filename="${safeName}"`
        : `inline; filename="${safeName}"`,
    };

    const rangeHeader = req.headers.get("range");
    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      const [startStr, endStr] = rangeHeader.replace("bytes=", "").split("-");
      const start = Math.max(0, parseInt(startStr, 10) || 0);
      const end = endStr
        ? Math.min(totalLength - 1, parseInt(endStr, 10))
        : totalLength - 1;

      if (start <= end && start < totalLength) {
        const chunk = buffer.subarray(start, end + 1);
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${start}-${end}/${totalLength}`,
            "Content-Length": String(chunk.length),
          },
        });
      }
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Length": String(totalLength),
      },
    });
  } catch (err) {
    console.error("Private media stream error:", err);
    return NextResponse.json(
      { error: "Unable to load private media." },
      { status: 404 }
    );
  }
}
