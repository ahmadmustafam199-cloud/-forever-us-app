"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Gift,
  Lock,
  MailOpen,
  Gamepad2,
  Shuffle,
  Send,
  Plus,
  X,
  MessageCircleHeart,
} from "lucide-react";
import { apiFetch, formatRelativeTime } from "@/lib/api-client";
import type {
  UserProfile,
  CoupleInfo,
  ActiveScreen,
  AffectionBurst,
} from "@/lib/types";

interface SurpriseItem {
  id: string;
  senderId: string;
  title: string;
  note: string;
  unlockAt: string | null;
  isLockedByTime: boolean;
  isOpened: boolean;
  openedAt: string | null;
  createdAt: string;
}

interface QuestionItem {
  id: string;
  prompt: string;
  category: string;
  husbandAnswer: string | null;
  wifeAnswer: string | null;
  createdAt: string;
}

interface LoveZoneData {
  dailyQuote: { id: number; text: string; author: string; mood: string };
  allQuotesCount: number;
  stats: {
    roses: number;
    kisses: number;
    hugs: number;
    sparkles: number;
    surprises: number;
  };
  recentAffections: Array<{
    id: string;
    senderId: string;
    kind: "rose" | "kiss" | "hug" | "sparkle";
    title: string;
    note: string;
    createdAt: string;
  }>;
  surprises: SurpriseItem[];
  questions: QuestionItem[];
}

interface LoveZoneScreenProps {
  user: UserProfile;
  partner: UserProfile | null;
  couple: CoupleInfo;
  refreshTick: number;
  onNavigate: (screen: ActiveScreen) => void;
  onTriggerBurst: (burst: AffectionBurst) => void;
  onSurpriseCountChange: (count: number) => void;
}

export function LoveZoneScreen({
  user,
  partner,
  refreshTick,
  onNavigate,
  onTriggerBurst,
  onSurpriseCountChange,
}: LoveZoneScreenProps) {
  const [data, setData] = useState<LoveZoneData | null>(null);
  const [customNote, setCustomNote] = useState("");
  const [sendingKind, setSendingKind] = useState<string | null>(null);

  // Surprise modal
  const [showNewSurprise, setShowNewSurprise] = useState(false);
  const [surpriseTitle, setSurpriseTitle] = useState("");
  const [surpriseBody, setSurpriseBody] = useState("");
  const [savingSurprise, setSavingSurprise] = useState(false);
  const [openedModal, setOpenedModal] = useState<SurpriseItem | null>(null);

  // Romantic Question answers
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [drawingQ, setDrawingQ] = useState(false);

  const loadLoveZone = useCallback(async () => {
    try {
      const res = await apiFetch<LoveZoneData>("/api/love-zone");
      setData(res);
      const unopenedForMe = res.surprises.filter(
        (s) => s.senderId !== user.id && !s.isOpened
      ).length;
      onSurpriseCountChange(unopenedForMe);
    } catch {
      // ignore
    }
  }, [user.id, onSurpriseCountChange]);

  useEffect(() => {
    loadLoveZone();
  }, [loadLoveZone, refreshTick]);

  async function sendAffection(
    kind: "rose" | "kiss" | "hug" | "sparkle",
    emoji: string,
    label: string
  ) {
    setSendingKind(kind);
    try {
      const noteText = customNote.trim();
      await apiFetch("/api/love-zone/affection", {
        method: "POST",
        body: JSON.stringify({
          kind,
          title: label,
          note: noteText,
          sendToChat: true,
        }),
      });
      setCustomNote("");
      onTriggerBurst({
        id: String(Date.now()),
        emoji,
        title: label,
        note:
          noteText ||
          `Floating across ${partner?.displayName.split(" ")[0] || "your spouse"}'s screen right now ❤️`,
      });
      await loadLoveZone();
    } catch {
      // ignore
    } finally {
      setSendingKind(null);
    }
  }

  async function handleCreateSurprise(e: React.FormEvent) {
    e.preventDefault();
    if (!surpriseBody.trim()) return;
    setSavingSurprise(true);
    try {
      await apiFetch("/api/love-zone/affection", {
        method: "POST",
        body: JSON.stringify({
          kind: "surprise",
          title: surpriseTitle.trim() || "Open When You Think of Me 💌",
          note: surpriseBody.trim(),
          sendToChat: false,
        }),
      });
      setSurpriseTitle("");
      setSurpriseBody("");
      setShowNewSurprise(false);
      onTriggerBurst({
        id: String(Date.now()),
        emoji: "🎁",
        title: "Wax-Sealed Surprise Sent!",
        note: `${partner?.displayName.split(" ")[0] || "Your spouse"} just received a secret envelope.`,
      });
      await loadLoveZone();
    } catch {
      // ignore
    } finally {
      setSavingSurprise(false);
    }
  }

  async function handleOpenSurprise(item: SurpriseItem) {
    if (item.senderId === user.id || item.isOpened) {
      setOpenedModal(item);
      return;
    }
    try {
      const res = await apiFetch<{ surprise: SurpriseItem }>(
        `/api/love-zone/affection/${item.id}`,
        { method: "PATCH" }
      );
      setOpenedModal(res.surprise);
      onTriggerBurst({
        id: String(Date.now()),
        emoji: "💝",
        title: res.surprise.title,
        note: "Wax seal broken — read your private love letter!",
      });
      await loadLoveZone();
    } catch {
      // ignore
    }
  }

  async function handleDrawRandomQuestion() {
    setDrawingQ(true);
    try {
      await apiFetch("/api/love-zone/questions", {
        method: "POST",
        body: JSON.stringify({ action: "draw_random" }),
      });
      await loadLoveZone();
    } catch {
      // ignore
    } finally {
      setDrawingQ(false);
    }
  }

  async function handleSubmitAnswer(questionId: string) {
    const text = (answerDrafts[questionId] || "").trim();
    if (!text) return;
    try {
      await apiFetch("/api/love-zone/questions", {
        method: "POST",
        body: JSON.stringify({
          action: "answer",
          questionId,
          answer: text,
        }),
      });
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: "" }));
      await loadLoveZone();
    } catch {
      // ignore
    }
  }

  const partnerFirst = partner?.displayName.split(" ")[0] || "Spouse";

  return (
    <div className="space-y-6 pb-6">
      {/* Mode Switcher: Love Zone <-> Couple Games */}
      <div className="grid grid-cols-2 rounded-2xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-1 shadow-2xs">
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-forever-gradient py-2.5 text-xs font-bold text-white shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Love Zone ❤️
        </button>
        <button
          type="button"
          onClick={() => onNavigate("games")}
          className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-[#625673] dark:text-[#A6A0C4] hover:text-[#E84A7F] transition"
        >
          <Gamepad2 className="w-4 h-4" />
          Couple Games
        </button>
      </div>

      {/* Virtual Roses, Kisses, Hugs & Animated Hearts Studio */}
      <section className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#141124] dark:text-white">
              Virtual Affection Studio
            </h2>
            <p className="text-xs text-[#625673] dark:text-[#A6A0C4]">
              Trigger live animated hearts, roses & kisses on {partnerFirst}&apos;s phone
            </p>
          </div>
        </div>

        <input
          type="text"
          value={customNote}
          onChange={(e) => setCustomNote(e.target.value)}
          placeholder={`Optional whisper for ${partnerFirst} (e.g. Missing your smile)...`}
          className="w-full rounded-2xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-4 py-2.5 text-xs text-[#141124] dark:text-white outline-none focus:border-[#E84A7F]"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              kind: "rose" as const,
              emoji: "🌹",
              label: "Velvet Rose",
              count: data?.stats.roses ?? 0,
              bg: "from-rose-500 to-red-600",
            },
            {
              kind: "kiss" as const,
              emoji: "💋",
              label: "Sweet Kiss",
              count: data?.stats.kisses ?? 0,
              bg: "from-pink-500 to-rose-600",
            },
            {
              kind: "hug" as const,
              emoji: "🫂",
              label: "Warm Hug",
              count: data?.stats.hugs ?? 0,
              bg: "from-purple-600 to-fuchsia-600",
            },
            {
              kind: "sparkle" as const,
              emoji: "💖",
              label: "Heart Shower",
              count: data?.stats.sparkles ?? 0,
              bg: "from-fuchsia-500 to-indigo-600",
            },
          ].map((item) => (
            <motion.button
              key={item.kind}
              type="button"
              whileTap={{ scale: 0.94 }}
              disabled={sendingKind !== null}
              onClick={() => sendAffection(item.kind, item.emoji, item.label)}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${item.bg} p-4 text-white text-left shadow-md hover:brightness-105 transition`}
            >
              <span className="absolute top-2.5 right-2.5 rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold">
                {item.count} sent
              </span>
              <div className="text-3xl mb-2">{item.emoji}</div>
              <p className="text-xs font-extrabold">{item.label}</p>
              <p className="text-[10px] text-white/80 mt-0.5">
                {sendingKind === item.kind ? "Showering..." : "Tap to send"}
              </p>
            </motion.button>
          ))}
        </div>

        {/* Recent affection feed */}
        {data && data.recentAffections.length > 0 && (
          <div className="pt-2 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#625673] dark:text-[#A6A0C4]">
              Recent Love Tokens
            </p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {data.recentAffections.slice(0, 4).map((a) => {
                const emoji =
                  a.kind === "rose"
                    ? "🌹"
                    : a.kind === "kiss"
                    ? "💋"
                    : a.kind === "hug"
                    ? "🫂"
                    : "💖";
                const fromMe = a.senderId === user.id;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-[#FFF8FA] dark:bg-[#0D1126] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{emoji}</span>
                      <p className="truncate text-[#141124] dark:text-white">
                        <strong>{fromMe ? "You" : partnerFirst}:</strong> {a.note}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#625673] dark:text-[#A6A0C4] shrink-0">
                      {formatRelativeTime(a.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Special Wax-Sealed Surprise Messages */}
      <section className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#141124] dark:text-white flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#E84A7F]" />
              Special Surprise Letters
            </h2>
            <p className="text-xs text-[#625673] dark:text-[#A6A0C4]">
              Leave wax-sealed secret love notes for your spouse to unwrap
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewSurprise(true)}
            className="inline-flex items-center gap-1 rounded-xl bg-forever-gradient px-3.5 py-2 text-xs font-bold text-white shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Seal Note
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(data?.surprises || []).map((s) => {
            const fromMe = s.senderId === user.id;
            const sealed = !fromMe && !s.isOpened;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleOpenSurprise(s)}
                className={`rounded-2xl p-4 text-left border transition active:scale-[0.99] ${
                  sealed
                    ? "bg-gradient-to-br from-[#4F1D75] to-[#E84A7F] text-white border-transparent shadow-lg"
                    : "bg-[#FFF8FA] dark:bg-[#0D1126] border-[#F3DCE6] dark:border-[#27305C] text-[#141124] dark:text-white hover:border-[#E84A7F]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                      sealed ? "text-rose-100" : "text-[#E84A7F]"
                    }`}
                  >
                    {sealed ? (
                      <>
                        <Lock className="w-3 h-3" /> Sealed From {partnerFirst}
                      </>
                    ) : (
                      <>
                        <MailOpen className="w-3 h-3" />{" "}
                        {fromMe ? `Sent by You` : `From ${partnerFirst}`}
                      </>
                    )}
                  </span>
                  <span className="text-[10px] opacity-75">
                    {formatRelativeTime(s.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-bold line-clamp-1">{s.title}</p>
                <p
                  className={`text-xs mt-1 line-clamp-2 ${
                    sealed ? "text-rose-100/90" : "text-[#625673] dark:text-[#A6A0C4]"
                  }`}
                >
                  {sealed
                    ? "Tap to break the wax seal & reveal your surprise message 🎁"
                    : s.note}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Random Romantic Questions */}
      <section className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#141124] dark:text-white flex items-center gap-2">
              <MessageCircleHeart className="w-4 h-4 text-[#E84A7F]" />
              Romantic Questions
            </h2>
            <p className="text-xs text-[#625673] dark:text-[#A6A0C4]">
              Draw intimate prompts and compare your answers side by side
            </p>
          </div>
          <button
            type="button"
            disabled={drawingQ}
            onClick={handleDrawRandomQuestion}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-[#1E2548] hover:bg-rose-100 px-3.5 py-2 text-xs font-bold text-[#E84A7F] transition shrink-0"
          >
            <Shuffle className="w-3.5 h-3.5" />
            {drawingQ ? "Drawing..." : "Draw New"}
          </button>
        </div>

        <div className="space-y-4">
          {(data?.questions || []).slice(0, 5).map((q) => {
            const myAnswer =
              user.role === "husband" ? q.husbandAnswer : q.wifeAnswer;
            const spouseAnswer =
              user.role === "husband" ? q.wifeAnswer : q.husbandAnswer;

            return (
              <div
                key={q.id}
                className="rounded-2xl bg-[#FFF9FB] dark:bg-[#0D1126] border border-[#F3DCE6] dark:border-[#27305C] p-4 space-y-3"
              >
                <span className="inline-block rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200 px-2.5 py-0.5 text-[10px] font-bold">
                  {q.category}
                </span>
                <p className="font-serif text-base font-semibold text-[#141124] dark:text-white">
                  {q.prompt}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-3">
                    <p className="text-[10px] font-bold uppercase text-[#E84A7F] mb-1">
                      Your Answer ({user.role})
                    </p>
                    {myAnswer ? (
                      <p className="text-xs text-[#141124] dark:text-white leading-relaxed">
                        {myAnswer}
                      </p>
                    ) : (
                      <div className="flex gap-1.5 mt-1">
                        <input
                          type="text"
                          value={answerDrafts[q.id] || ""}
                          onChange={(e) =>
                            setAnswerDrafts((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                          placeholder="Share from your heart..."
                          className="flex-1 min-w-0 rounded-lg bg-[#FFF8FA] dark:bg-[#0D1126] border border-[#F3DCE6] dark:border-[#27305C] px-2.5 py-1.5 text-xs outline-none focus:border-[#E84A7F]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitAnswer(q.id)}
                          className="p-2 rounded-lg bg-forever-gradient text-white shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-3">
                    <p className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-300 mb-1">
                      {partnerFirst}&apos;s Answer
                    </p>
                    <p className="text-xs text-[#625673] dark:text-[#B8B2D6] leading-relaxed italic">
                      {spouseAnswer || `Waiting for ${partnerFirst} to answer...`}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Compose New Surprise Modal */}
      <AnimatePresence>
        {showNewSurprise && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNewSurprise(false)}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.form
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreateSurprise}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#141124] dark:text-white">
                  Seal a Surprise Love Letter 💌
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewSurprise(false)}
                  className="p-1 text-slate-400 hover:text-rose-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
                  Envelope Label
                </label>
                <input
                  type="text"
                  required
                  value={surpriseTitle}
                  onChange={(e) => setSurpriseTitle(e.target.value)}
                  placeholder="e.g. Open Tonight After Dinner 🌹"
                  className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
                  Secret Love Message
                </label>
                <textarea
                  rows={4}
                  required
                  value={surpriseBody}
                  onChange={(e) => setSurpriseBody(e.target.value)}
                  placeholder={`Pour your heart out to ${partnerFirst}...`}
                  className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={savingSurprise}
                className="w-full rounded-2xl bg-forever-gradient py-3 text-sm font-bold text-white shadow-md"
              >
                {savingSurprise ? "Sealing with Love..." : `Send Sealed Envelope to ${partnerFirst}`}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revealed Surprise Love Letter Modal */}
      <AnimatePresence>
        {openedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpenedModal(null)}
            className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-gradient-to-br from-[#FFF9FB] to-[#FFEBF3] dark:from-[#161B36] dark:to-[#24183E] border-2 border-rose-300/60 dark:border-rose-400/30 p-7 shadow-2xl text-center space-y-4"
            >
              <div className="text-5xl">💌</div>
              <h3 className="font-serif text-2xl font-bold text-[#141124] dark:text-white">
                {openedModal.title}
              </h3>
              <p className="font-serif italic text-base leading-relaxed text-[#382E47] dark:text-rose-100 whitespace-pre-wrap">
                &ldquo;{openedModal.note}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => setOpenedModal(null)}
                className="mt-2 rounded-full bg-forever-gradient px-7 py-2.5 text-xs font-bold text-white shadow-md"
              >
                Keep Close to My Heart ❤️
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
