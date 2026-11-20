"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Heart,
  MessageCircleHeart,
  Phone,
  Video,
  Sparkles,
  CalendarHeart,
  Gamepad2,
  Images,
  RefreshCw,
  Send,
  ChevronRight,
  Gift,
  Lock,
} from "lucide-react";
import { Avatar } from "./Avatar";
import {
  apiFetch,
  computeRelationshipMetrics,
  formatLastSeen,
} from "@/lib/api-client";
import { DAILY_ROMANTIC_MESSAGES } from "@/lib/romantic-data";
import type {
  UserProfile,
  CoupleInfo,
  MemoryItem,
  CalendarEventItem,
  ActiveScreen,
  AffectionBurst,
} from "@/lib/types";

interface HomeDashboardProps {
  user: UserProfile;
  partner: UserProfile | null;
  couple: CoupleInfo;
  memories: MemoryItem[];
  upcomingEvent: CalendarEventItem | null;
  unreadMessages: number;
  unopenedSurprises: number;
  onNavigate: (screen: ActiveScreen) => void;
  onStartCall: (type: "audio" | "video") => void;
  onTriggerBurst: (burst: AffectionBurst) => void;
  onCoupleUpdated: (couple: CoupleInfo) => void;
}

const QUICK_AFFECTIONS = [
  { kind: "rose" as const, emoji: "🌹", label: "Send Rose", tone: "from-rose-500/15 to-pink-500/10 border-rose-200 dark:border-rose-500/25" },
  { kind: "kiss" as const, emoji: "💋", label: "Send Kiss", tone: "from-pink-500/15 to-fuchsia-500/10 border-pink-200 dark:border-pink-500/25" },
  { kind: "hug" as const, emoji: "🫂", label: "Warm Hug", tone: "from-purple-500/15 to-violet-500/10 border-purple-200 dark:border-purple-500/25" },
  { kind: "sparkle" as const, emoji: "💖", label: "Heart Burst", tone: "from-fuchsia-500/15 to-rose-500/10 border-fuchsia-200 dark:border-fuchsia-500/25" },
];

export function HomeDashboard({
  user,
  partner,
  couple,
  memories,
  upcomingEvent,
  unreadMessages,
  unopenedSurprises,
  onNavigate,
  onStartCall,
  onTriggerBurst,
  onCoupleUpdated,
}: HomeDashboardProps) {
  const [sendingKind, setSendingKind] = useState<string | null>(null);
  const [sharingQuote, setSharingQuote] = useState(false);
  const [quoteShared, setQuoteShared] = useState(false);

  const metrics = computeRelationshipMetrics(
    couple.relationshipStartDate,
    couple.anniversaryDate
  );

  const daySeed = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const currentQuote =
    DAILY_ROMANTIC_MESSAGES[
      (daySeed + (couple.dailyQuoteIndex || 0)) % DAILY_ROMANTIC_MESSAGES.length
    ];

  async function handleQuickAffection(
    kind: "rose" | "kiss" | "hug" | "sparkle",
    emoji: string,
    label: string
  ) {
    if (sendingKind) return;
    setSendingKind(kind);
    try {
      await apiFetch("/api/love-zone/affection", {
        method: "POST",
        body: JSON.stringify({ kind, sendToChat: true }),
      });
      onTriggerBurst({
        id: String(Date.now()),
        emoji,
        title: `${label} Delivered!`,
        note: `Sent straight to ${partner?.displayName.split(" ")[0] || "your spouse"} with floating hearts ❤️`,
      });
    } catch {
      // handled silently
    } finally {
      setSendingKind(null);
    }
  }

  async function handleShuffleQuote() {
    const nextIdx = ((couple.dailyQuoteIndex || 0) + 1) % DAILY_ROMANTIC_MESSAGES.length;
    try {
      const data = await apiFetch<{ couple: CoupleInfo }>("/api/couple/settings", {
        method: "PATCH",
        body: JSON.stringify({ dailyQuoteIndex: nextIdx }),
      });
      onCoupleUpdated(data.couple);
      setQuoteShared(false);
    } catch {
      // ignore
    }
  }

  async function handleShareQuoteToChat() {
    if (sharingQuote) return;
    setSharingQuote(true);
    try {
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          messageType: "text",
          content: `💌 "${currentQuote.text}" — thinking of you today ❤️`,
        }),
      });
      setQuoteShared(true);
      setTimeout(() => setQuoteShared(false), 2500);
    } catch {
      // ignore
    } finally {
      setSharingQuote(false);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Hero Couple Sanctuary Card */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-forever-gradient p-6 text-white shadow-xl shadow-rose-500/20"
      >
        <div className="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full bg-purple-950/40 blur-2xl pointer-events-none" />

        {/* Couple avatars + online status */}
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center">
            <Avatar
              src={user.avatarUrl}
              name={user.displayName}
              role={user.role}
              isOnline={true}
              showStatus
              size="lg"
              className="ring-2 ring-white/40 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="-mx-2 z-10 w-8 h-8 rounded-full bg-white text-[#E84A7F] flex items-center justify-center shadow-md"
            >
              <Heart className="w-4 h-4 fill-[#E84A7F]" />
            </motion.div>
            <Avatar
              src={partner?.avatarUrl}
              name={partner?.displayName || "Partner"}
              role={partner?.role || (user.role === "husband" ? "wife" : "husband")}
              isOnline={partner?.isOnline}
              showStatus
              size="lg"
              className="ring-2 ring-white/40 rounded-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStartCall("audio")}
              title="Audio Call"
              className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition"
            >
              <Phone className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => onStartCall("video")}
              title="Video Call"
              className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 flex items-center justify-center active:scale-95 transition"
            >
              <Video className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Relationship Day Counter */}
        <div className="relative mt-5">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-100/90">
            <span>{couple.coupleName}</span>
            <span>·</span>
            <span>
              {partner
                ? formatLastSeen(partner.lastSeenAt, partner.isOnline, partner.isTyping)
                : "Connected"}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2.5 flex-wrap">
            <span className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">
              {metrics.daysTogether.toLocaleString()}
            </span>
            <span className="text-base sm:text-lg font-medium text-rose-100">
              Days in Love ❤️
            </span>
          </div>
        </div>

        {/* Anniversary Countdown strip */}
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-black/20 backdrop-blur-md border border-white/15 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-rose-200 font-semibold">
              Anniversary Countdown
            </p>
            <p className="text-xs text-white/90 mt-0.5">{metrics.formattedAnniversary}</p>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm font-bold">
            <span className="rounded-lg bg-white/15 px-2.5 py-1">
              {metrics.nextAnniversaryDays}d
            </span>
            <span className="rounded-lg bg-white/15 px-2.5 py-1">
              {metrics.nextAnniversaryHours}h
            </span>
            <span className="rounded-lg bg-white/15 px-2.5 py-1">
              {metrics.nextAnniversaryMins}m
            </span>
          </div>
        </div>
      </motion.section>

      {/* Instant Affection Bar */}
      <section>
        <div className="flex items-center justify-between mb-2.5 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#625673] dark:text-[#A6A0C4]">
            Send Instant Affection
          </h2>
          <span className="text-[11px] text-[#E84A7F] font-medium">
            Tap to shower {partner?.displayName.split(" ")[0] || "spouse"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {QUICK_AFFECTIONS.map((item) => (
            <button
              key={item.kind}
              type="button"
              disabled={sendingKind !== null}
              onClick={() => handleQuickAffection(item.kind, item.emoji, item.label)}
              className={`group flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} border py-3.5 px-2 hover:scale-[1.02] active:scale-95 transition shadow-xs`}
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">
                {item.emoji}
              </span>
              <span className="mt-1.5 text-[11px] font-semibold text-[#141124] dark:text-white text-center leading-tight">
                {sendingKind === item.kind ? "Sending..." : item.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Unopened Surprise Banner if any */}
      {unopenedSurprises > 0 && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate("love")}
          className="w-full flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#5B1E6E] to-[#E84A7F] p-4 text-white shadow-lg shadow-purple-900/15 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {unopenedSurprises} Sealed Surprise{" "}
                {unopenedSurprises > 1 ? "Letters" : "Letter"} Waiting!
              </p>
              <p className="text-xs text-rose-100">
                Tap to unwrap your spouse&apos;s secret love message 💌
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
        </motion.button>
      )}

      {/* Daily Romantic Message */}
      <section className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-500/15 px-3 py-1 text-[11px] font-bold text-[#E84A7F]">
            <Sparkles className="w-3.5 h-3.5" />
            Daily Romantic Note · {currentQuote.mood}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleShuffleQuote}
              className="p-2 rounded-xl text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548] hover:text-[#E84A7F] transition"
              title="New romantic note"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleShareQuoteToChat}
              disabled={sharingQuote}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-[#1E2548] hover:bg-rose-100 px-3 py-1.5 text-xs font-semibold text-[#E84A7F] transition"
            >
              <Send className="w-3.5 h-3.5" />
              {quoteShared ? "Sent ❤️" : "Whisper"}
            </button>
          </div>
        </div>
        <p className="font-serif italic text-lg sm:text-xl leading-relaxed text-[#141124] dark:text-white">
          &ldquo;{currentQuote.text}&rdquo;
        </p>
      </section>

      {/* Private World Feature Hub (Direct access to Chat, Couple Games, Shared Calendar) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => onNavigate("chat")}
          className="flex items-center sm:flex-col sm:items-start justify-between gap-3 rounded-2xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] hover:border-[#E84A7F] p-4 text-left transition shadow-xs"
        >
          <div className="flex items-center gap-3 sm:w-full sm:justify-between">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-[#E84A7F] flex items-center justify-center">
              <MessageCircleHeart className="w-5 h-5" />
            </div>
            {unreadMessages > 0 && (
              <span className="rounded-full bg-[#E84A7F] text-white text-xs font-bold px-2.5 py-0.5">
                {unreadMessages} new
              </span>
            )}
          </div>
          <div className="flex-1 sm:mt-1">
            <p className="text-sm font-bold text-[#141124] dark:text-white">Private Chat</p>
            <p className="text-xs text-[#625673] dark:text-[#A6A0C4] mt-0.5">
              Voice, stickers, photos & receipts
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("games")}
          className="flex items-center sm:flex-col sm:items-start justify-between gap-3 rounded-2xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] hover:border-[#E84A7F] p-4 text-left transition shadow-xs"
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div className="flex-1 sm:mt-1">
            <p className="text-sm font-bold text-[#141124] dark:text-white">Couple Games</p>
            <p className="text-xs text-[#625673] dark:text-[#A6A0C4] mt-0.5">
              Love Quiz, Truth or Dare & Quests
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate("calendar")}
          className="flex items-center sm:flex-col sm:items-start justify-between gap-3 rounded-2xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] hover:border-[#E84A7F] p-4 text-left transition shadow-xs"
        >
          <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-500/15 text-pink-600 dark:text-pink-300 flex items-center justify-center">
            <CalendarHeart className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0 sm:mt-1">
            <p className="text-sm font-bold text-[#141124] dark:text-white">Shared Calendar</p>
            <p className="text-xs text-[#625673] dark:text-[#A6A0C4] mt-0.5 truncate">
              {upcomingEvent
                ? `Next: ${upcomingEvent.title}`
                : "Date nights & anniversaries"}
            </p>
          </div>
        </button>
      </section>

      {/* Cherished Memories Preview */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Images className="w-4 h-4 text-[#E84A7F]" />
            <h2 className="text-sm font-bold text-[#141124] dark:text-white">
              Cherished Memories
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("memories")}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#E84A7F] hover:underline"
          >
            Open Gallery
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {memories.length === 0 ? (
          <button
            type="button"
            onClick={() => onNavigate("memories")}
            className="w-full rounded-2xl border border-dashed border-[#F3DCE6] dark:border-[#27305C] py-8 text-center text-xs text-[#625673] dark:text-[#A6A0C4] hover:border-[#E84A7F]"
          >
            Tap to upload your first private couple memory 📸
          </button>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {memories.slice(0, 4).map((mem) => (
              <button
                key={mem.id}
                type="button"
                onClick={() => onNavigate("memories")}
                className="group relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#FFF0F5] dark:bg-[#1E2548] shadow-sm text-left"
              >
                {mem.mediaType === "video" ? (
                  <video
                    src={mem.url}
                    muted
                    playsInline
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mem.url}
                    alt={mem.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                {mem.isFavorite && (
                  <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
                    <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
                  </span>
                )}
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <p className="text-xs font-bold text-white line-clamp-1">{mem.title}</p>
                  <p className="text-[10px] text-white/75 mt-0.5">{mem.album}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Private Vault Footer Note */}
      <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#625673] dark:text-[#A6A0C4]">
        <Lock className="w-3 h-3 text-emerald-500" />
        <span>
          Protected Private Storage · {couple.e2eeEnabled ? "AES-256-GCM E2EE Active" : "Encrypted Sanctuary"}
        </span>
      </div>
    </div>
  );
}
