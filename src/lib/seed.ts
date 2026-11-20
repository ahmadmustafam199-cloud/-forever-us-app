import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  couples,
  mediaFiles,
  messages,
  messageReactions,
  callLogs,
  memories,
  affections,
  coupleQuestions,
  quizQuestions,
  coupleChallenges,
  calendarEvents,
  notifications,
} from "@/db/schema";
import {
  SEED_MEDIA_DIR,
  generateInviteCode,
  generateE2eeSalt,
} from "./security";
import { STARTER_CHALLENGES, ROMANTIC_QUESTION_DECK } from "./romantic-data";

export const DEMO_HUSBAND_EMAIL = "husband@foreverus.love";
export const DEMO_WIFE_EMAIL = "wife@foreverus.love";
export const DEMO_PASSWORD = "ForeverUs2026!";

let seedPromise: Promise<void> | null = null;

async function getSeedFileSize(fileName: string): Promise<number> {
  try {
    const stat = await fs.stat(path.join(SEED_MEDIA_DIR, fileName));
    return stat.size;
  } catch {
    return 120_000;
  }
}

export async function initializeNewCoupleContent(
  coupleId: string,
  husbandId: string,
  wifeId: string,
  anniversaryDate: string
): Promise<void> {
  // Seed starter couple challenges
  await db.insert(coupleChallenges).values(
    STARTER_CHALLENGES.map((c) => ({
      coupleId,
      title: c.title,
      description: c.description,
      category: c.category,
      points: c.points,
      isCompleted: false,
    }))
  );

  // Seed 2 starter romantic questions
  await db.insert(coupleQuestions).values([
    {
      coupleId,
      prompt: ROMANTIC_QUESTION_DECK[0].prompt,
      category: ROMANTIC_QUESTION_DECK[0].category,
    },
    {
      coupleId,
      prompt: ROMANTIC_QUESTION_DECK[1].prompt,
      category: ROMANTIC_QUESTION_DECK[1].category,
    },
  ]);

  // Seed starter Love Quiz (one from each spouse)
  await db.insert(quizQuestions).values([
    {
      coupleId,
      authorId: husbandId,
      question: "What would be my dream surprise weekend together?",
      optionsJson: JSON.stringify([
        "Cozy mountain cabin with fireplace",
        "Sunset coastal villa by the sea",
        "Parisian cafe & art museum stroll",
        "Staycation with homemade dinner & movies",
      ]),
      correctIndex: 1,
    },
    {
      coupleId,
      authorId: wifeId,
      question: "Which love language makes me feel the most cherished?",
      optionsJson: JSON.stringify([
        "Uninterrupted quality time together",
        "Handwritten notes & sweet words",
        "Long warm hugs & holding hands",
        "Thoughtful little everyday surprises",
      ]),
      correctIndex: 0,
    },
  ]);

  // Seed upcoming Friday date night & next anniversary in Shared Calendar
  const nextWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);
  const year = new Date().getFullYear();
  const md = anniversaryDate.slice(5) || "06-18";
  let nextAnniv = `${year}-${md}`;
  if (nextAnniv < new Date().toISOString().slice(0, 10)) {
    nextAnniv = `${year + 1}-${md}`;
  }

  await db.insert(calendarEvents).values([
    {
      coupleId,
      createdById: husbandId,
      title: "Private Candlelit Date Night",
      eventDate: nextWeekStr,
      eventTime: "20:00",
      category: "date_night",
      location: "Our Favorite Corner Table",
      notes: "Celebrating connecting our private Forever Us world ❤️",
      reminder: true,
    },
    {
      coupleId,
      createdById: wifeId,
      title: "Our Wedding Anniversary ❤️",
      eventDate: nextAnniv,
      eventTime: "19:00",
      category: "anniversary",
      location: "Romantic Evening Escape",
      notes: "Another unforgettable year of loving each other.",
      reminder: true,
    },
  ]);

  // Welcome message
  await db.insert(messages).values({
    coupleId,
    senderId: husbandId,
    messageType: "text",
    content: "Welcome to our private world, my love ❤️ Just the two of us here forever.",
    status: "delivered",
    deliveredAt: new Date(),
  });
}

export async function ensureDemoSeed(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = runDemoSeed().finally(() => {
    seedPromise = null;
  });
  return seedPromise;
}

async function runDemoSeed(): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEMO_HUSBAND_EMAIL))
    .limit(1);

  if (existing.length > 0) return;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // Compute upcoming anniversary ~24 days from today so the countdown always looks alive
  const now = new Date();
  const upcomingAnniv = new Date(now.getTime() + 24 * 24 * 60 * 60 * 1000);
  const annivMonth = String(upcomingAnniv.getUTCMonth() + 1).padStart(2, "0");
  const annivDay = String(upcomingAnniv.getUTCDate()).padStart(2, "0");
  const anniversaryDate = `2022-${annivMonth}-${annivDay}`;
  const upcomingAnnivDate = `${upcomingAnniv.getUTCFullYear()}-${annivMonth}-${annivDay}`;

  const [couple] = await db
    .insert(couples)
    .values({
      coupleName: "Daniel & Sophia",
      inviteCode: generateInviteCode(),
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      anniversaryDate,
      relationshipStartDate: "2021-05-14",
      e2eeSalt: generateE2eeSalt(),
      e2eeEnabled: false,
      dailyQuoteIndex: 0,
    })
    .returning();

  const [husband] = await db
    .insert(users)
    .values({
      email: DEMO_HUSBAND_EMAIL,
      passwordHash,
      displayName: "Daniel Carter",
      role: "husband",
      bio: "Forever grateful to call Sophia my wife & best friend ❤️",
      coupleId: couple.id,
      theme: "light",
      isOnline: true,
      lastSeenAt: new Date(now.getTime() - 2 * 60 * 1000),
    })
    .returning();

  const [wife] = await db
    .insert(users)
    .values({
      email: DEMO_WIFE_EMAIL,
      passwordHash,
      displayName: "Sophia Carter",
      role: "wife",
      bio: "Counting every sunset with my favorite person 🌹✨",
      coupleId: couple.id,
      theme: "light",
      isOnline: true,
      lastSeenAt: new Date(now.getTime() - 60 * 1000),
    })
    .returning();

  // Lock couple strictly to Daniel & Sophia
  await db
    .update(couples)
    .set({ husbandId: husband.id, wifeId: wife.id })
    .where(eq(couples.id, couple.id));

  // Register private seed media records (never in public/)
  const [
    husbandAvatarMedia,
    wifeAvatarMedia,
    sunsetMedia,
    coffeeMedia,
    dinnerMedia,
    strollMedia,
  ] = await db
    .insert(mediaFiles)
    .values([
      {
        coupleId: couple.id,
        uploaderId: husband.id,
        storagePath: "seed:husband-avatar.jpg",
        originalName: "daniel-portrait.jpg",
        mimeType: "image/jpeg",
        category: "avatar",
        sizeBytes: await getSeedFileSize("husband-avatar.jpg"),
      },
      {
        coupleId: couple.id,
        uploaderId: wife.id,
        storagePath: "seed:wife-avatar.jpg",
        originalName: "sophia-portrait.jpg",
        mimeType: "image/jpeg",
        category: "avatar",
        sizeBytes: await getSeedFileSize("wife-avatar.jpg"),
      },
      {
        coupleId: couple.id,
        uploaderId: husband.id,
        storagePath: "seed:memory-sunset.jpg",
        originalName: "mediterranean-sunset.jpg",
        mimeType: "image/jpeg",
        category: "image",
        sizeBytes: await getSeedFileSize("memory-sunset.jpg"),
      },
      {
        coupleId: couple.id,
        uploaderId: wife.id,
        storagePath: "seed:memory-coffee.jpg",
        originalName: "sunday-morning-lattes.jpg",
        mimeType: "image/jpeg",
        category: "image",
        sizeBytes: await getSeedFileSize("memory-coffee.jpg"),
      },
      {
        coupleId: couple.id,
        uploaderId: husband.id,
        storagePath: "seed:memory-dinner.jpg",
        originalName: "rooftop-anniversary.jpg",
        mimeType: "image/jpeg",
        category: "image",
        sizeBytes: await getSeedFileSize("memory-dinner.jpg"),
      },
      {
        coupleId: couple.id,
        uploaderId: wife.id,
        storagePath: "seed:memory-stroll.jpg",
        originalName: "cherry-blossom-walk.jpg",
        mimeType: "image/jpeg",
        category: "image",
        sizeBytes: await getSeedFileSize("memory-stroll.jpg"),
      },
    ])
    .returning();

  await db
    .update(users)
    .set({ avatarMediaId: husbandAvatarMedia.id })
    .where(eq(users.id, husband.id));

  await db
    .update(users)
    .set({ avatarMediaId: wifeAvatarMedia.id })
    .where(eq(users.id, wife.id));

  // Shared Memories
  await db.insert(memories).values([
    {
      coupleId: couple.id,
      uploaderId: husband.id,
      mediaId: sunsetMedia.id,
      mediaType: "photo",
      title: "Cliffside Sunset Over the Sea",
      caption: "The sky turned rose and violet while you rested your head on my shoulder. Still my favorite evening of our lives.",
      album: "Anniversary Trips",
      memoryDate: "2025-08-19",
      isFavorite: true,
    },
    {
      coupleId: couple.id,
      uploaderId: wife.id,
      mediaId: coffeeMedia.id,
      mediaType: "photo",
      title: "Slow Sunday Lattes & Pink Roses",
      caption: "You surprised me with fresh garden roses and a folded love note tucked beside my morning cappuccino.",
      album: "Little Joys",
      memoryDate: "2026-01-11",
      isFavorite: true,
    },
    {
      coupleId: couple.id,
      uploaderId: husband.id,
      mediaId: dinnerMedia.id,
      mediaType: "photo",
      title: "Midnight Rooftop Toast",
      caption: "Dancing under string lights after everyone else had left the terrace — two hearts, one world.",
      album: "Date Nights",
      memoryDate: "2025-11-22",
      isFavorite: true,
    },
    {
      coupleId: couple.id,
      uploaderId: wife.id,
      mediaId: strollMedia.id,
      mediaType: "photo",
      title: "Cherry Blossom Evening Stroll",
      caption: "Blush petals drifting down the lane while we planned our next ten years hand in hand.",
      album: "Our Moments",
      memoryDate: "2026-03-28",
      isFavorite: false,
    },
  ]);

  // Seed authentic private chat history
  const t = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60 * 1000);

  const [m1] = await db
    .insert(messages)
    .values({
      coupleId: couple.id,
      senderId: wife.id,
      messageType: "text",
      content: "Good morning my love! Just found the sweetest little note you slipped into my coat pocket 🥺❤️",
      status: "read",
      deliveredAt: t(185),
      readAt: t(182),
      createdAt: t(186),
      updatedAt: t(186),
    })
    .returning();

  const [m2] = await db
    .insert(messages)
    .values({
      coupleId: couple.id,
      senderId: husband.id,
      messageType: "text",
      content: "Knew it would make you smile on your commute 😘 Hope your morning is as radiant as you are.",
      replyToId: m1.id,
      status: "read",
      deliveredAt: t(180),
      readAt: t(179),
      createdAt: t(180),
      updatedAt: t(180),
    })
    .returning();

  const [m3] = await db
    .insert(messages)
    .values({
      coupleId: couple.id,
      senderId: wife.id,
      messageType: "image",
      mediaId: coffeeMedia.id,
      content: "Look at this throwback from our Sunday cafe morning — take me back this weekend? ☕🌹",
      status: "read",
      deliveredAt: t(95),
      readAt: t(92),
      createdAt: t(95),
      updatedAt: t(95),
    })
    .returning();

  await db.insert(messages).values([
    {
      coupleId: couple.id,
      senderId: husband.id,
      messageType: "sticker",
      stickerId: "date-night",
      content: "Date Night!",
      status: "read",
      deliveredAt: t(90),
      readAt: t(89),
      createdAt: t(90),
      updatedAt: t(90),
    },
    {
      coupleId: couple.id,
      senderId: husband.id,
      messageType: "text",
      content: "Already reserved our rooftop corner table for Friday at 7:30 PM! Also left a sealed surprise for you in the Love Zone 💌",
      status: "read",
      deliveredAt: t(42),
      readAt: t(40),
      createdAt: t(42),
      updatedAt: t(42),
    },
    {
      coupleId: couple.id,
      senderId: wife.id,
      messageType: "text",
      content: "You really are my favorite human in the entire universe. Call me on video whenever you take a break! 💖",
      status: "delivered",
      deliveredAt: t(12),
      createdAt: t(12),
      updatedAt: t(12),
    },
  ]);

  await db.insert(messageReactions).values([
    { messageId: m1.id, userId: husband.id, emoji: "❤️" },
    { messageId: m2.id, userId: wife.id, emoji: "🥰" },
    { messageId: m3.id, userId: husband.id, emoji: "🌹" },
  ]);

  // Seed call history
  await db.insert(callLogs).values([
    {
      coupleId: couple.id,
      callerId: wife.id,
      calleeId: husband.id,
      callType: "video",
      status: "ended",
      startedAt: new Date(now.getTime() - 16 * 60 * 60 * 1000),
      answeredAt: new Date(now.getTime() - 16 * 60 * 60 * 1000 + 6000),
      endedAt: new Date(now.getTime() - 16 * 60 * 60 * 1000 + 1428 * 1000),
      durationSec: 1422,
    },
    {
      coupleId: couple.id,
      callerId: husband.id,
      calleeId: wife.id,
      callType: "audio",
      status: "ended",
      startedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      answeredAt: new Date(now.getTime() - 4 * 60 * 60 * 1000 + 4000),
      endedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000 + 516 * 1000),
      durationSec: 512,
    },
  ]);

  // Seed Love Zone affections & special wax-sealed surprise messages
  await db.insert(affections).values([
    {
      coupleId: couple.id,
      senderId: husband.id,
      kind: "rose",
      title: "Velvet Red Rose",
      note: "One fresh rose because you looked breathtaking this morning.",
      isOpened: true,
      openedAt: t(120),
      createdAt: t(140),
    },
    {
      coupleId: couple.id,
      senderId: wife.id,
      kind: "kiss",
      title: "Forehead Kiss",
      note: "Sending a soft kiss to carry you through your afternoon 💋",
      isOpened: true,
      openedAt: t(75),
      createdAt: t(80),
    },
    {
      coupleId: couple.id,
      senderId: wife.id,
      kind: "hug",
      title: "Warm Evening Embrace",
      note: "Counting down the hours until I'm back in your arms.",
      isOpened: true,
      openedAt: t(50),
      createdAt: t(55),
    },
    {
      coupleId: couple.id,
      senderId: husband.id,
      kind: "surprise",
      title: "Open When You Want to Smile 🎁",
      note: "I secretly packed your favorite silk scarf and booked us a private stargazing terrace after dinner this Friday. Every year with you feels sweeter than our honeymoon. Forever yours, Daniel ❤️",
      isOpened: false,
      createdAt: t(38),
    },
    {
      coupleId: couple.id,
      senderId: wife.id,
      kind: "surprise",
      title: "A Secret Vow Just For You 💌",
      note: "Even on our busiest weeks, hearing your keys unlock the front door is still the best moment of my entire day. Thank you for being my safe harbor, my laughter, and my home. All my love, Sophia 🌹",
      isOpened: false,
      createdAt: t(20),
    },
  ]);

  // Seed romantic questions
  await db.insert(coupleQuestions).values([
    {
      coupleId: couple.id,
      prompt: ROMANTIC_QUESTION_DECK[0].prompt,
      category: ROMANTIC_QUESTION_DECK[0].category,
      husbandAnswer: "When it poured rain on our third date and instead of running for cover, you laughed and pulled me under the streetlight to dance.",
      wifeAnswer: "The night you brought homemade soup and stayed up reading to me until 2 AM when I lost my voice. I knew you were my forever.",
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      coupleId: couple.id,
      prompt: ROMANTIC_QUESTION_DECK[1].prompt,
      category: ROMANTIC_QUESTION_DECK[1].category,
      husbandAnswer: "A whitewashed balcony overlooking Lake Como with warm espresso and zero alarms set.",
      wifeAnswer: null,
      createdAt: t(60),
    },
  ]);

  // Seed Love Quiz questions (both answered and ready-to-play for both spouses!)
  await db.insert(quizQuestions).values([
    {
      coupleId: couple.id,
      authorId: wife.id,
      question: "What is Sophia's all-time favorite late-night comfort treat with you?",
      optionsJson: JSON.stringify([
        "Warm chocolate lava cake & strawberries",
        "Pistachio gelato on a night walk",
        "Homemade cinnamon crepes in pajamas",
        "Salted caramel macarons & herbal tea",
      ]),
      correctIndex: 0,
      partnerGuessIndex: null,
    },
    {
      coupleId: couple.id,
      authorId: husband.id,
      question: "Which moment from our wedding day does Daniel replay the most?",
      optionsJson: JSON.stringify([
        "Cutting our tiered raspberry cake",
        "Seeing you walk down the aisle as the strings played",
        "Our private last dance under fairy lights",
        "Driving off under a shower of sparklers",
      ]),
      correctIndex: 1,
      partnerGuessIndex: null,
    },
    {
      coupleId: couple.id,
      authorId: wife.id,
      question: "Which flower instantly makes Sophia think of our first anniversary?",
      optionsJson: JSON.stringify([
        "White lilies",
        "Blush English garden roses",
        "Lavender sprigs",
        "Sunflowers",
      ]),
      correctIndex: 1,
      partnerGuessIndex: 1,
      answeredAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      coupleId: couple.id,
      authorId: husband.id,
      question: "What destination tops Daniel's dream anniversary trip list for us?",
      optionsJson: JSON.stringify([
        "Amalfi Coast cliffside villa",
        "Kyoto during cherry blossom season",
        "Swiss Alps panoramic train",
        "Maldives overwater bungalow",
      ]),
      correctIndex: 0,
      partnerGuessIndex: 0,
      answeredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
  ]);

  // Seed Couple Challenges
  await db.insert(coupleChallenges).values([
    {
      coupleId: couple.id,
      title: STARTER_CHALLENGES[0].title,
      description: STARTER_CHALLENGES[0].description,
      category: STARTER_CHALLENGES[0].category,
      points: STARTER_CHALLENGES[0].points,
      isCompleted: true,
      completedById: husband.id,
      completedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      coupleId: couple.id,
      title: STARTER_CHALLENGES[1].title,
      description: STARTER_CHALLENGES[1].description,
      category: STARTER_CHALLENGES[1].category,
      points: STARTER_CHALLENGES[1].points,
      isCompleted: true,
      completedById: wife.id,
      completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      coupleId: couple.id,
      title: STARTER_CHALLENGES[2].title,
      description: STARTER_CHALLENGES[2].description,
      category: STARTER_CHALLENGES[2].category,
      points: STARTER_CHALLENGES[2].points,
      isCompleted: false,
    },
    {
      coupleId: couple.id,
      title: STARTER_CHALLENGES[3].title,
      description: STARTER_CHALLENGES[3].description,
      category: STARTER_CHALLENGES[3].category,
      points: STARTER_CHALLENGES[3].points,
      isCompleted: false,
    },
    {
      coupleId: couple.id,
      title: STARTER_CHALLENGES[4].title,
      description: STARTER_CHALLENGES[4].description,
      category: STARTER_CHALLENGES[4].category,
      points: STARTER_CHALLENGES[4].points,
      isCompleted: false,
    },
  ]);

  // Seed Shared Calendar events across this month & upcoming anniversary
  const inDays = (d: number) =>
    new Date(now.getTime() + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await db.insert(calendarEvents).values([
    {
      coupleId: couple.id,
      createdById: husband.id,
      title: "Rooftop Candlelit Date Night",
      eventDate: inDays(2),
      eventTime: "19:30",
      category: "date_night",
      location: "La Terrazza Overlook",
      notes: "Corner table reserved + stargazing walk afterward ✨",
      reminder: true,
    },
    {
      coupleId: couple.id,
      createdById: wife.id,
      title: "Sunday Botanical Garden Picnic",
      eventDate: inDays(6),
      eventTime: "11:00",
      category: "milestone",
      location: "Rose Conservatory Lawn",
      notes: "Bring fresh strawberries, sparkling lemonade, and our film camera.",
      reminder: true,
    },
    {
      coupleId: couple.id,
      createdById: husband.id,
      title: "Couple's Spa & Sunset Escape",
      eventDate: inDays(14),
      eventTime: "16:00",
      category: "travel",
      location: "Serenity Coastal Retreat",
      notes: "Unplugged afternoon just for the two of us.",
      reminder: true,
    },
    {
      coupleId: couple.id,
      createdById: wife.id,
      title: "Our Wedding Anniversary ❤️",
      eventDate: upcomingAnnivDate,
      eventTime: "18:30",
      category: "anniversary",
      location: "Private Oceanview Suite",
      notes: "Celebrating four magical years of marriage — two hearts, one private world.",
      reminder: true,
    },
  ]);

  // Seed initial notification for each spouse
  await db.insert(notifications).values([
    {
      coupleId: couple.id,
      recipientId: wife.id,
      actorId: husband.id,
      kind: "affection",
      title: "New Sealed Surprise from Daniel 🎁",
      body: "Open When You Want to Smile — waiting in your Love Zone.",
      isRead: false,
    },
    {
      coupleId: couple.id,
      recipientId: husband.id,
      actorId: wife.id,
      kind: "affection",
      title: "New Sealed Surprise from Sophia 💌",
      body: "A Secret Vow Just For You — tap to break the seal in Love Zone.",
      isRead: false,
    },
  ]);
}
