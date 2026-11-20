import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const couples = pgTable("couples", {
  id: uuid("id").defaultRandom().primaryKey(),
  coupleName: varchar("couple_name", { length: 120 }).default("Forever Us").notNull(),
  inviteCode: varchar("invite_code", { length: 20 }).unique().notNull(),
  inviteExpiresAt: timestamp("invite_expires_at").notNull(),
  husbandId: uuid("husband_id").unique(),
  wifeId: uuid("wife_id").unique(),
  anniversaryDate: varchar("anniversary_date", { length: 16 }).default("2023-06-18").notNull(),
  relationshipStartDate: varchar("relationship_start_date", { length: 16 }).default("2022-02-14").notNull(),
  e2eeSalt: varchar("e2ee_salt", { length: 128 }).notNull(),
  e2eeEnabled: boolean("e2ee_enabled").default(false).notNull(),
  dailyQuoteIndex: integer("daily_quote_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  role: varchar("role", { length: 16 }).notNull(), // 'husband' | 'wife'
  bio: varchar("bio", { length: 240 }).default("Two hearts, one private world ❤️").notNull(),
  avatarMediaId: uuid("avatar_media_id"),
  coupleId: uuid("couple_id").references(() => couples.id, { onDelete: "set null" }),
  theme: varchar("theme", { length: 16 }).default("light").notNull(), // 'light' | 'dark'
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  isOnline: boolean("is_online").default(false).notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  typingUntil: timestamp("typing_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: varchar("token_hash", { length: 128 }).unique().notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    deviceLabel: varchar("device_label", { length: 120 }).default("Android Device").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const mediaFiles = pgTable(
  "media_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id").references(() => couples.id, { onDelete: "cascade" }),
    uploaderId: uuid("uploader_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    storagePath: text("storage_path").notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    category: varchar("category", { length: 24 }).notNull(), // 'image' | 'video' | 'audio' | 'document' | 'avatar'
    sizeBytes: integer("size_bytes").notNull(),
    durationSec: integer("duration_sec"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("media_couple_idx").on(t.coupleId)]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    messageType: varchar("message_type", { length: 24 }).notNull(), // 'text' | 'sticker' | 'image' | 'video' | 'voice' | 'document' | 'affection'
    content: text("content").default("").notNull(),
    isEncrypted: boolean("is_encrypted").default(false).notNull(),
    encryptionIv: varchar("encryption_iv", { length: 64 }),
    stickerId: varchar("sticker_id", { length: 64 }),
    mediaId: uuid("media_id").references(() => mediaFiles.id, { onDelete: "set null" }),
    replyToId: uuid("reply_to_id"),
    isForwarded: boolean("is_forwarded").default(false).notNull(),
    isEdited: boolean("is_edited").default(false).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    status: varchar("status", { length: 16 }).default("sent").notNull(), // 'sent' | 'delivered' | 'read'
    deliveredAt: timestamp("delivered_at"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("messages_couple_created_idx").on(t.coupleId, t.createdAt)]
);

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .references(() => messages.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    emoji: varchar("emoji", { length: 16 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("reaction_msg_user_uniq").on(t.messageId, t.userId)]
);

export const callLogs = pgTable(
  "call_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    callerId: uuid("caller_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    calleeId: uuid("callee_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    callType: varchar("call_type", { length: 16 }).notNull(), // 'audio' | 'video'
    status: varchar("status", { length: 20 }).notNull(), // 'ringing' | 'active' | 'ended' | 'rejected' | 'missed'
    startedAt: timestamp("started_at").defaultNow().notNull(),
    answeredAt: timestamp("answered_at"),
    endedAt: timestamp("ended_at"),
    durationSec: integer("duration_sec").default(0).notNull(),
  },
  (t) => [index("calls_couple_started_idx").on(t.coupleId, t.startedAt)]
);

export const callSignals = pgTable(
  "call_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    callId: uuid("call_id")
      .references(() => callLogs.id, { onDelete: "cascade" })
      .notNull(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    signalType: varchar("signal_type", { length: 24 }).notNull(), // 'offer' | 'answer' | 'ice-candidate' | 'media-state' | 'hangup'
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("call_signals_call_idx").on(t.callId, t.createdAt)]
);

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    uploaderId: uuid("uploader_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    mediaId: uuid("media_id")
      .references(() => mediaFiles.id, { onDelete: "cascade" })
      .notNull(),
    mediaType: varchar("media_type", { length: 16 }).notNull(), // 'photo' | 'video'
    title: varchar("title", { length: 140 }).notNull(),
    caption: text("caption").default("").notNull(),
    album: varchar("album", { length: 80 }).default("Our Moments").notNull(),
    memoryDate: varchar("memory_date", { length: 16 }).notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("memories_couple_idx").on(t.coupleId, t.memoryDate)]
);

export const affections = pgTable(
  "affections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    kind: varchar("kind", { length: 24 }).notNull(), // 'rose' | 'kiss' | 'hug' | 'sparkle' | 'surprise'
    title: varchar("title", { length: 140 }).default("").notNull(),
    note: text("note").default("").notNull(),
    unlockAt: timestamp("unlock_at"),
    isOpened: boolean("is_opened").default(false).notNull(),
    openedAt: timestamp("opened_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("affections_couple_idx").on(t.coupleId, t.createdAt)]
);

export const coupleQuestions = pgTable(
  "couple_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    prompt: text("prompt").notNull(),
    category: varchar("category", { length: 40 }).default("Deep Love").notNull(),
    husbandAnswer: text("husband_answer"),
    wifeAnswer: text("wife_answer"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("questions_couple_idx").on(t.coupleId, t.createdAt)]
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    question: text("question").notNull(),
    optionsJson: text("options_json").notNull(),
    correctIndex: integer("correct_index").notNull(),
    partnerGuessIndex: integer("partner_guess_index"),
    answeredAt: timestamp("answered_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("quiz_couple_idx").on(t.coupleId, t.createdAt)]
);

export const coupleChallenges = pgTable(
  "couple_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").default("").notNull(),
    category: varchar("category", { length: 32 }).default("Romance").notNull(),
    points: integer("points").default(25).notNull(),
    isCompleted: boolean("is_completed").default(false).notNull(),
    completedById: uuid("completed_by_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("challenges_couple_idx").on(t.coupleId, t.createdAt)]
);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    createdById: uuid("created_by_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    eventDate: varchar("event_date", { length: 16 }).notNull(),
    eventTime: varchar("event_time", { length: 16 }).default("19:30").notNull(),
    category: varchar("category", { length: 32 }).default("date_night").notNull(),
    location: varchar("location", { length: 160 }).default("").notNull(),
    notes: text("notes").default("").notNull(),
    reminder: boolean("reminder").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("calendar_couple_date_idx").on(t.coupleId, t.eventDate)]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coupleId: uuid("couple_id")
      .references(() => couples.id, { onDelete: "cascade" })
      .notNull(),
    recipientId: uuid("recipient_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("notifications_recipient_idx").on(t.recipientId, t.createdAt)]
);
