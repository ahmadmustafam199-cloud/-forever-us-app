export interface UserProfile {
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

export interface CoupleInfo {
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

export interface ChatMessage {
  id: string;
  coupleId: string;
  senderId: string;
  messageType:
    | "text"
    | "sticker"
    | "image"
    | "video"
    | "voice"
    | "document"
    | "affection";
  content: string;
  decryptedContent?: string;
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

export interface CallRecord {
  id: string;
  coupleId: string;
  callerId: string;
  calleeId: string;
  callType: "audio" | "video";
  status: "ringing" | "active" | "ended" | "rejected" | "missed";
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number;
}

export interface MemoryItem {
  id: string;
  uploaderId: string;
  mediaId: string;
  mediaType: "photo" | "video";
  title: string;
  caption: string;
  album: string;
  memoryDate: string;
  isFavorite: boolean;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  url: string;
  downloadUrl: string;
  createdAt: string;
}

export interface AffectionBurst {
  id: string;
  emoji: string;
  title: string;
  note: string;
  senderName?: string;
}

export interface NotificationItem {
  id: string;
  coupleId: string;
  recipientId: string;
  actorId: string | null;
  kind: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface CalendarEventItem {
  id: string;
  coupleId: string;
  createdById: string;
  title: string;
  eventDate: string;
  eventTime: string;
  category: "anniversary" | "date_night" | "travel" | "birthday" | "milestone";
  location: string;
  notes: string;
  reminder: boolean;
  createdAt: string;
}

export type ActiveScreen =
  | "home"
  | "chat"
  | "love"
  | "games"
  | "memories"
  | "calendar"
  | "profile";
