"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Gamepad2,
  Trophy,
  Flame,
  CheckCircle2,
  Circle,
  Plus,
  Send,
  Shuffle,
  Heart,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type {
  UserProfile,
  ActiveScreen,
  AffectionBurst,
} from "@/lib/types";

interface QuizItem {
  id: string;
  authorId: string;
  question: string;
  options: string[];
  correctIndex: number | null;
  partnerGuessIndex: number | null;
  answeredAt: string | null;
}

interface ChallengeItem {
  id: string;
  title: string;
  description: string;
  category: string;
  points: number;
  isCompleted: boolean;
}

interface TruthDareItem {
  type: "truth" | "dare";
  tier: "Sweet" | "Romantic" | "Deep";
  prompt: string;
}

interface GamesPayload {
  quizzes: QuizItem[];
  quizStats: {
    total: number;
    answered: number;
    correct: number;
    syncScore: number;
  };
  challenges: ChallengeItem[];
  earnedPoints: number;
  truthOrDareDeck: TruthDareItem[];
}

interface CoupleGamesScreenProps {
  user: UserProfile;
  partner: UserProfile | null;
  refreshTick: number;
  onNavigate: (screen: ActiveScreen) => void;
  onTriggerBurst: (burst: AffectionBurst) => void;
}

export function CoupleGamesScreen({
  user,
  partner,
  refreshTick,
  onNavigate,
  onTriggerBurst,
}: CoupleGamesScreenProps) {
  const [tab, setTab] = useState<"quiz" | "tod" | "challenges">("quiz");
  const [data, setData] = useState<GamesPayload | null>(null);

  // Create quiz state
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [qText, setQText] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [savingQuiz, setSavingQuiz] = useState(false);

  // Truth or Dare state
  const [tierFilter, setTierFilter] = useState<"All" | "Sweet" | "Romantic" | "Deep">("All");
  const [activeCard, setActiveCard] = useState<TruthDareItem | null>(null);
  const [sentCardToast, setSentCardToast] = useState(false);

  // Add challenge state
  const [showAddChallenge, setShowAddChallenge] = useState(false);
  const [chTitle, setChTitle] = useState("");
  const [chDesc, setChDesc] = useState("");

  const partnerFirst = partner?.displayName.split(" ")[0] || "Spouse";

  const loadGames = useCallback(async () => {
    try {
      const res = await apiFetch<GamesPayload>("/api/games");
      setData(res);
      setActiveCard((prev) => prev ?? res.truthOrDareDeck[0] ?? null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames, refreshTick]);

  async function handleGuessQuiz(quizId: string, guessIndex: number) {
    try {
      const res = await apiFetch<{ isCorrect: boolean }>("/api/games/quiz", {
        method: "POST",
        body: JSON.stringify({ action: "guess", quizId, guessIndex }),
      });
      if (res.isCorrect) {
        onTriggerBurst({
          id: String(Date.now()),
          emoji: "💘",
          title: "Soulmate Match! +20 pts",
          note: `You know ${partnerFirst}'s heart inside and out!`,
        });
      }
      await loadGames();
    } catch {
      // ignore
    }
  }

  async function handleCreateQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!qText.trim() || opts.some((o) => !o.trim())) return;
    setSavingQuiz(true);
    try {
      await apiFetch("/api/games/quiz", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          question: qText.trim(),
          options: opts.map((o) => o.trim()),
          correctIndex: correctIdx,
        }),
      });
      setQText("");
      setOpts(["", "", "", ""]);
      setCorrectIdx(0);
      setShowCreateQuiz(false);
      await loadGames();
    } catch {
      // ignore
    } finally {
      setSavingQuiz(false);
    }
  }

  function drawTruthOrDare(type: "truth" | "dare") {
    if (!data) return;
    const pool = data.truthOrDareDeck.filter(
      (c) => c.type === type && (tierFilter === "All" || c.tier === tierFilter)
    );
    if (pool.length === 0) return;
    const candidates = pool.filter((c) => c.prompt !== activeCard?.prompt);
    const list = candidates.length > 0 ? candidates : pool;
    setActiveCard(list[Math.floor(Math.random() * list.length)]);
    setSentCardToast(false);
  }

  async function sendCardToChat() {
    if (!activeCard) return;
    try {
      await apiFetch("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          messageType: "text",
          content: `🎲 Couple ${activeCard.type.toUpperCase()} (${activeCard.tier}): ${activeCard.prompt}`,
        }),
      });
      setSentCardToast(true);
      setTimeout(() => setSentCardToast(false), 2500);
    } catch {
      // ignore
    }
  }

  async function toggleChallenge(ch: ChallengeItem) {
    const next = !ch.isCompleted;
    try {
      await apiFetch("/api/games/challenges", {
        method: "POST",
        body: JSON.stringify({
          action: "toggle",
          challengeId: ch.id,
          isCompleted: next,
        }),
      });
      if (next) {
        onTriggerBurst({
          id: String(Date.now()),
          emoji: "🏆",
          title: `Challenge Completed! +${ch.points} pts`,
          note: ch.title,
        });
      }
      await loadGames();
    } catch {
      // ignore
    }
  }

  async function handleCreateChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!chTitle.trim()) return;
    try {
      await apiFetch("/api/games/challenges", {
        method: "POST",
        body: JSON.stringify({
          action: "create",
          title: chTitle.trim(),
          description: chDesc.trim(),
          category: "Romance",
          points: 35,
        }),
      });
      setChTitle("");
      setChDesc("");
      setShowAddChallenge(false);
      await loadGames();
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Mode Switcher */}
      <div className="grid grid-cols-2 rounded-2xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-1 shadow-2xs">
        <button
          type="button"
          onClick={() => onNavigate("love")}
          className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-[#625673] dark:text-[#A6A0C4] hover:text-[#E84A7F] transition"
        >
          <Sparkles className="w-4 h-4" />
          Love Zone ❤️
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-forever-gradient py-2.5 text-xs font-bold text-white shadow-sm"
        >
          <Gamepad2 className="w-4 h-4" />
          Couple Games
        </button>
      </div>

      {/* Couple Sync Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-gradient-to-br from-[#E84A7F] to-[#8C2562] p-4 text-white shadow-md">
          <div className="flex items-center gap-1.5 text-xs text-rose-100 font-semibold">
            <Heart className="w-3.5 h-3.5 fill-white" />
            Soulmate Sync
          </div>
          <p className="mt-1 font-serif text-3xl font-bold">
            {data?.quizStats.syncScore ?? 100}%
          </p>
          <p className="text-[11px] text-rose-100/85 mt-0.5">
            {data?.quizStats.correct ?? 0} of {data?.quizStats.answered ?? 0} quiz matches
          </p>
        </div>
        <div className="rounded-3xl bg-gradient-to-br from-[#4F1D75] to-[#0D1126] p-4 text-white shadow-md">
          <div className="flex items-center gap-1.5 text-xs text-purple-200 font-semibold">
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            Love Quest Score
          </div>
          <p className="mt-1 font-serif text-3xl font-bold">
            {data?.earnedPoints ?? 0} pts
          </p>
          <p className="text-[11px] text-purple-200/80 mt-0.5">
            {data?.challenges.filter((c) => c.isCompleted).length ?? 0} challenges done
          </p>
        </div>
      </div>

      {/* Game Selector Tabs */}
      <div className="flex gap-2">
        {(
          [
            { id: "quiz", label: "💘 Love Quiz" },
            { id: "tod", label: "🔥 Truth or Dare" },
            { id: "challenges", label: "✨ Challenges" },
          ] as const
        ).map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setTab(g.id)}
            className={`flex-1 rounded-2xl py-2.5 px-2 text-xs font-bold transition ${
              tab === g.id
                ? "bg-[#0D1126] dark:bg-[#E84A7F] text-white shadow-sm"
                : "bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] text-[#625673] dark:text-[#A6A0C4]"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LOVE QUIZ */}
      {tab === "quiz" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-[#141124] dark:text-white">
              How Well Do You Know Each Other?
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateQuiz((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-[#1E2548] px-3 py-1.5 text-xs font-bold text-[#E84A7F]"
            >
              <Plus className="w-3.5 h-3.5" />
              New Question
            </button>
          </div>

          {showCreateQuiz && (
            <form
              onSubmit={handleCreateQuiz}
              className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 space-y-3 shadow-xs"
            >
              <p className="text-xs font-bold text-[#E84A7F]">
                Write a question about yourself for {partnerFirst} to guess:
              </p>
              <input
                type="text"
                required
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="e.g. What was my favorite part of our honeymoon?"
                className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
              />
              <div className="space-y-2">
                {opts.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOpt"
                      checked={correctIdx === idx}
                      onChange={() => setCorrectIdx(idx)}
                      className="accent-[#E84A7F] w-4 h-4"
                      title="Mark as correct answer"
                    />
                    <input
                      type="text"
                      required
                      value={val}
                      onChange={(e) => {
                        const copy = [...opts];
                        copy[idx] = e.target.value;
                        setOpts(copy);
                      }}
                      placeholder={`Option ${idx + 1}${
                        correctIdx === idx ? " (Correct Answer)" : ""
                      }`}
                      className="flex-1 rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2 text-xs outline-none focus:border-[#E84A7F]"
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                disabled={savingQuiz}
                className="w-full rounded-xl bg-forever-gradient py-2.5 text-xs font-bold text-white"
              >
                {savingQuiz ? "Sending Quiz..." : `Challenge ${partnerFirst}`}
              </button>
            </form>
          )}

          {(data?.quizzes || []).map((q) => {
            const isAuthor = q.authorId === user.id;
            const answered = q.partnerGuessIndex !== null;

            return (
              <div
                key={q.id}
                className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 space-y-3 shadow-xs"
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-[#E84A7F]">
                    {isAuthor ? `Asked by You` : `From ${partnerFirst}`}
                  </span>
                  <span
                    className={
                      answered
                        ? q.partnerGuessIndex === q.correctIndex
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                        : "text-purple-600 dark:text-purple-300"
                    }
                  >
                    {answered
                      ? q.partnerGuessIndex === q.correctIndex
                        ? "Matched! ❤️"
                        : "Sweet Try 💕"
                      : isAuthor
                      ? `Waiting for ${partnerFirst}`
                      : "Your Turn to Guess!"}
                  </span>
                </div>

                <p className="text-sm font-bold text-[#141124] dark:text-white">
                  {q.question}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, idx) => {
                    const isCorrect = q.correctIndex === idx;
                    const isGuess = q.partnerGuessIndex === idx;
                    const canClick = !isAuthor && !answered;

                    let style =
                      "border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] text-[#141124] dark:text-white";
                    if (answered || isAuthor) {
                      if (isCorrect) {
                        style =
                          "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 font-bold";
                      } else if (isGuess && !isCorrect) {
                        style =
                          "border-rose-400 bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-200";
                      }
                    } else if (canClick) {
                      style += " hover:border-[#E84A7F] hover:bg-rose-50 dark:hover:bg-[#1E2548] cursor-pointer";
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!canClick}
                        onClick={() => handleGuessQuiz(q.id, idx)}
                        className={`rounded-xl border px-3.5 py-2.5 text-left text-xs transition ${style}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: TRUTH OR DARE */}
      {tab === "tod" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            {(["All", "Sweet", "Romantic", "Deep"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  tierFilter === t
                    ? "bg-rose-500 text-white"
                    : "bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] text-[#625673] dark:text-[#A6A0C4]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {activeCard && (
            <motion.div
              key={activeCard.prompt}
              initial={{ rotateY: 12, opacity: 0, scale: 0.96 }}
              animate={{ rotateY: 0, opacity: 1, scale: 1 }}
              className={`rounded-3xl p-7 text-white text-center shadow-xl space-y-4 ${
                activeCard.type === "truth"
                  ? "bg-gradient-to-br from-[#5B1E6E] via-[#3A195E] to-[#0D1126]"
                  : "bg-gradient-to-br from-[#E84A7F] via-[#B5286B] to-[#4F1D75]"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-xs font-extrabold uppercase tracking-widest">
                <Flame className="w-3.5 h-3.5" />
                {activeCard.type} · {activeCard.tier}
              </span>

              <p className="font-serif text-xl sm:text-2xl font-semibold leading-relaxed py-3">
                {activeCard.prompt}
              </p>

              <button
                type="button"
                onClick={sendCardToChat}
                className="inline-flex items-center gap-2 rounded-full bg-white text-[#5B1E6E] px-5 py-2.5 text-xs font-bold shadow-md hover:bg-rose-50 active:scale-95 transition"
              >
                <Send className="w-3.5 h-3.5" />
                {sentCardToast
                  ? `Sent to ${partnerFirst} in Chat! ❤️`
                  : `Send to ${partnerFirst} in Chat`}
              </button>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => drawTruthOrDare("truth")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#5B1E6E] hover:brightness-110 py-3.5 text-sm font-bold text-white shadow-md active:scale-95 transition"
            >
              <Shuffle className="w-4 h-4" />
              Draw Truth
            </button>
            <button
              type="button"
              onClick={() => drawTruthOrDare("dare")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-[#E84A7F] hover:brightness-110 py-3.5 text-sm font-bold text-white shadow-md active:scale-95 transition"
            >
              <Flame className="w-4 h-4" />
              Draw Dare
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: COUPLE CHALLENGES */}
      {tab === "challenges" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-[#141124] dark:text-white">
              Shared Romantic Quests
            </h3>
            <button
              type="button"
              onClick={() => setShowAddChallenge((v) => !v)}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-[#1E2548] px-3 py-1.5 text-xs font-bold text-[#E84A7F]"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Quest
            </button>
          </div>

          {showAddChallenge && (
            <form
              onSubmit={handleCreateChallenge}
              className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-4 space-y-2.5"
            >
              <input
                type="text"
                required
                value={chTitle}
                onChange={(e) => setChTitle(e.target.value)}
                placeholder="Challenge title (e.g. Watch the sunrise with cocoa)"
                className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2 text-xs outline-none focus:border-[#E84A7F]"
              />
              <input
                type="text"
                value={chDesc}
                onChange={(e) => setChDesc(e.target.value)}
                placeholder="Sweet details..."
                className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2 text-xs outline-none focus:border-[#E84A7F]"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-forever-gradient py-2 text-xs font-bold text-white"
              >
                Add Couple Challenge (+35 pts)
              </button>
            </form>
          )}

          {(data?.challenges || []).map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => toggleChallenge(ch)}
              className={`w-full flex items-start gap-3.5 rounded-2xl border p-4 text-left transition ${
                ch.isCompleted
                  ? "bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
                  : "bg-white dark:bg-[#161B36] border-[#F3DCE6] dark:border-[#27305C] hover:border-[#E84A7F]"
              }`}
            >
              {ch.isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-sm font-bold ${
                      ch.isCompleted
                        ? "line-through text-[#625673] dark:text-[#A6A0C4]"
                        : "text-[#141124] dark:text-white"
                    }`}
                  >
                    {ch.title}
                  </p>
                  <span className="rounded-full bg-rose-50 dark:bg-rose-500/15 text-[#E84A7F] px-2.5 py-0.5 text-[10px] font-bold shrink-0">
                    +{ch.points} pts
                  </span>
                </div>
                {ch.description && (
                  <p className="text-xs text-[#625673] dark:text-[#A6A0C4] mt-1 leading-relaxed">
                    {ch.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
