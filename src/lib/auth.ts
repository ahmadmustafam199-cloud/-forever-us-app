import { NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, couples } from "@/db/schema";
import {
  SESSION_COOKIE_NAME,
  generateSessionToken,
  hashToken,
  signMediaUrl,
  computeCoupleSafetyNumber,
} from "./security";
import { isUserConnectedRealtime } from "./realtime";

export type UserRecord = typeof users.$inferSelect;
export type CoupleRecord = typeof couples.$inferSelect;

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  role: "husband" | "wife";
  bio: string;
  avatarUrl: string | null;
  coupleId: string | null;
  theme: "light" | "dark";
  notificationsEnabled: boolean;
  isOnline: boolean;
  lastSeenAt: string;
  isTyping: boolean;
}

export interface CoupleDTO {
  id: string;
  coupleName: string;
  inviteCode: string;
  inviteExpiresAt: string;
  husbandId: string | null;
  wifeId: string | null;
  isComplete: boolean;
  anniversaryDate: string;
  relationshipStartDate: string;
  e2eeEnabled: boolean;
  e2eeSalt: string;
  safetyNumber: string;
  dailyQuoteIndex: number;
}

export interface AuthContext {
  user: UserRecord;
  couple: CoupleRecord | null;
  partner: UserRecord | null;
  rawToken: string;
}

export function extractRawToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.length >= 32) return bearer;
  }

  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken && queryToken.length >= 32) {
    return queryToken;
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      const val = decodeURIComponent(part.slice(SESSION_COOKIE_NAME.length + 1));
      if (val.length >= 32) return val;
    }
  }
  return null;
}

export async function getAuthContext(
  req: Request,
  options?: { skipPresenceTouch?: boolean }
): Promise<AuthContext | null> {
  const rawToken = extractRawToken(req);
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const found = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (found.length === 0) return null;

  let user = found[0].user;

  // Throttle DB presence updates to every 20 seconds
  if (
    !options?.skipPresenceTouch &&
    (!user.isOnline || now.getTime() - new Date(user.lastSeenAt).getTime() > 20_000)
  ) {
    await db
      .update(users)
      .set({ isOnline: true, lastSeenAt: now })
      .where(eq(users.id, user.id));
    user = { ...user, isOnline: true, lastSeenAt: now };
  }

  let couple: CoupleRecord | null = null;
  let partner: UserRecord | null = null;

  if (user.coupleId) {
    const coupleRows = await db
      .select()
      .from(couples)
      .where(eq(couples.id, user.coupleId))
      .limit(1);

    if (coupleRows.length > 0) {
      const candidate = coupleRows[0];
      // Strict 2-authorized-user guard: ONLY the registered Husband and Wife may access this couple space
      if (candidate.husbandId === user.id || candidate.wifeId === user.id) {
        couple = candidate;
        const partnerId =
          candidate.husbandId === user.id ? candidate.wifeId : candidate.husbandId;
        if (partnerId) {
          const partnerRows = await db
            .select()
            .from(users)
            .where(eq(users.id, partnerId))
            .limit(1);
          if (partnerRows.length > 0) {
            partner = partnerRows[0];
          }
        }
      }
    }
  }

  return { user, couple, partner, rawToken };
}

export async function createUserSession(
  userId: string,
  deviceLabel = "Forever Us Android"
): Promise<string> {
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await db.insert(sessions).values({
    tokenHash,
    userId,
    deviceLabel: deviceLabel.slice(0, 120),
    expiresAt,
  });

  await db
    .update(users)
    .set({ isOnline: true, lastSeenAt: new Date() })
    .where(eq(users.id, userId));

  return rawToken;
}

export function attachSessionCookie(res: NextResponse, rawToken: string): void {
  res.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.HTTPS === "true",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function formatUserDTO(user: UserRecord): UserDTO {
  const now = Date.now();
  const lastSeenMs = new Date(user.lastSeenAt).getTime();
  const recentlyActive = user.isOnline && now - lastSeenMs < 95_000;
  const realtimeConnected = isUserConnectedRealtime(user.id);
  const isTyping = user.typingUntil ? new Date(user.typingUntil).getTime() > now : false;

  const avatarScope = user.coupleId ?? user.id;
  const avatarUrl = user.avatarMediaId
    ? signMediaUrl(user.avatarMediaId, avatarScope)
    : null;

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role === "wife" ? "wife" : "husband",
    bio: user.bio,
    avatarUrl,
    coupleId: user.coupleId,
    theme: user.theme === "dark" ? "dark" : "light",
    notificationsEnabled: user.notificationsEnabled,
    isOnline: recentlyActive || realtimeConnected,
    lastSeenAt: new Date(user.lastSeenAt).toISOString(),
    isTyping,
  };
}

export function formatCoupleDTO(couple: CoupleRecord): CoupleDTO {
  const isComplete = Boolean(couple.husbandId && couple.wifeId);
  return {
    id: couple.id,
    coupleName: couple.coupleName,
    inviteCode: isComplete ? "PAIRED-LOCKED" : couple.inviteCode,
    inviteExpiresAt: new Date(couple.inviteExpiresAt).toISOString(),
    husbandId: couple.husbandId,
    wifeId: couple.wifeId,
    isComplete,
    anniversaryDate: couple.anniversaryDate,
    relationshipStartDate: couple.relationshipStartDate,
    e2eeEnabled: couple.e2eeEnabled,
    e2eeSalt: couple.e2eeSalt,
    safetyNumber: computeCoupleSafetyNumber(
      couple.id,
      couple.e2eeSalt,
      couple.husbandId,
      couple.wifeId
    ),
    dailyQuoteIndex: couple.dailyQuoteIndex,
  };
}
