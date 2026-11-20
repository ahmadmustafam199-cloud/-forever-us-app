import crypto from "crypto";
import path from "path";
import fs from "fs/promises";

export const SESSION_COOKIE_NAME = "forever_us_session";
export const PRIVATE_UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");
export const SEED_MEDIA_DIR = path.join(process.cwd(), "src", "assets", "seed-media");

function getSigningSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  const anchor = process.env.DATABASE_URL || "forever-us-private-sanctuary-local";
  return crypto.createHash("sha256").update(`forever-us-hmac::${anchor}`).digest("hex");
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return `LUV-${code}`;
}

export function generateE2eeSalt(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function computeCoupleSafetyNumber(
  coupleId: string,
  e2eeSalt: string,
  husbandId: string | null,
  wifeId: string | null
): string {
  const digest = crypto
    .createHash("sha256")
    .update(`FOREVER_US_E2EE_V1|${coupleId}|${e2eeSalt}|${husbandId ?? "pending"}|${wifeId ?? "pending"}`)
    .digest();

  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    const val = digest.readUInt16BE(i * 2) % 100000;
    groups.push(val.toString().padStart(5, "0"));
  }
  return groups.join(" ");
}

export function signMediaUrl(
  mediaId: string,
  scopeId: string,
  options?: { download?: boolean; ttlSeconds?: number }
): string {
  const ttl = options?.ttlSeconds ?? 1800; // 30 minutes short-lived private token
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${mediaId}:${scopeId}:${exp}`;
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payload)
    .digest("hex");

  const params = new URLSearchParams({
    scope: scopeId,
    exp: String(exp),
    sig,
  });
  if (options?.download) {
    params.set("download", "1");
  }
  return `/api/media/${mediaId}?${params.toString()}`;
}

export function verifyMediaSignature(
  mediaId: string,
  scopeId: string,
  expStr: string | null,
  sig: string | null
): boolean {
  if (!expStr || !sig || !scopeId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`${mediaId}:${scopeId}:${exp}`)
    .digest("hex");

  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export type MediaCategory = "image" | "video" | "audio" | "document" | "avatar";

const MAX_SIZE_BY_CATEGORY: Record<MediaCategory, number> = {
  avatar: 8 * 1024 * 1024, // 8 MB
  image: 15 * 1024 * 1024, // 15 MB
  video: 45 * 1024 * 1024, // 45 MB
  audio: 15 * 1024 * 1024, // 15 MB
  document: 20 * 1024 * 1024, // 20 MB
};

const ALLOWED_MIMES: Record<MediaCategory, string[]> = {
  avatar: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "video/webm"],
  document: [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

function matchesMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 4) return mime === "text/plain" && buffer.length > 0;

  if (mime === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mime === "image/gif") {
    return buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
  }
  if (mime === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (mime === "application/pdf") {
    return buffer.subarray(0, 4).toString("ascii") === "%PDF";
  }
  if (mime === "video/webm" || mime === "audio/webm") {
    return (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    );
  }
  if (mime === "video/mp4" || mime === "video/quicktime" || mime === "audio/mp4") {
    return buffer.length >= 8 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
  }
  if (mime === "audio/ogg") {
    return buffer.subarray(0, 4).toString("ascii") === "OggS";
  }
  if (mime === "audio/wav") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WAVE"
    );
  }
  if (mime === "audio/mpeg" || mime === "audio/mp3") {
    const isId3 = buffer.subarray(0, 3).toString("ascii") === "ID3";
    const isFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    return isId3 || isFrameSync;
  }
  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }
  if (mime === "application/msword") {
    return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  }
  if (mime === "text/plain") {
    // Reject binary null bytes
    for (let i = 0; i < Math.min(buffer.length, 512); i++) {
      if (buffer[i] === 0x00) return false;
    }
    return true;
  }
  return false;
}

function getSafeExtension(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  };
  return map[mime] ?? ".bin";
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name || "attachment").replace(/[^\w.\- ()]/g, "_");
  return base.slice(0, 180) || "attachment";
}

export async function validateAndStorePrivateFile(
  file: File,
  category: MediaCategory
): Promise<{
  storagePath: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}> {
  const normalizedMime = (file.type || "").split(";")[0].trim().toLowerCase();
  const allowed = ALLOWED_MIMES[category];
  if (!allowed || !allowed.includes(normalizedMime)) {
    throw new Error(
      `Unsupported file format (${normalizedMime || "unknown"}) for ${category}.`
    );
  }

  const maxSize = MAX_SIZE_BY_CATEGORY[category];
  if (file.size <= 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (file.size > maxSize) {
    throw new Error(
      `File exceeds maximum size of ${Math.round(maxSize / (1024 * 1024))}MB.`
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!matchesMagicBytes(buffer, normalizedMime)) {
    throw new Error("File signature validation failed. Upload rejected for security.");
  }

  await fs.mkdir(PRIVATE_UPLOAD_DIR, { recursive: true });
  const ext = getSafeExtension(normalizedMime);
  const fileName = `${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(PRIVATE_UPLOAD_DIR, fileName);
  await fs.writeFile(fullPath, buffer, { mode: 0o600 });

  const resolvedMime =
    category === "audio" && normalizedMime === "video/webm"
      ? "audio/webm"
      : normalizedMime;

  return {
    storagePath: fileName,
    originalName: sanitizeFilename(file.name),
    mimeType: resolvedMime,
    sizeBytes: buffer.length,
  };
}
