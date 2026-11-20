"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  Video,
  Search,
  X,
  Smile,
  Paperclip,
  Mic,
  Send,
  Check,
  CheckCheck,
  Reply,
  Forward,
  Pencil,
  Trash2,
  FileText,
  Download,
  Image as ImageIcon,
  Lock,
  Play,
  Pause,
  Square,
  History,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  MoreVertical,
} from "lucide-react";
import { Avatar } from "./Avatar";
import {
  apiFetch,
  apiUploadMedia,
  formatChatTime,
  formatLastSeen,
  formatBytes,
  formatDuration,
  formatRelativeTime,
} from "@/lib/api-client";
import {
  COUPLE_STICKERS,
  QUICK_EMOJIS,
  REACTION_EMOJIS,
} from "@/lib/romantic-data";
import { encryptCoupleText, decryptCoupleText } from "@/lib/e2ee-client";
import type {
  UserProfile,
  CoupleInfo,
  ChatMessage,
  CallRecord,
} from "@/lib/types";

interface PrivateChatScreenProps {
  user: UserProfile;
  partner: UserProfile | null;
  couple: CoupleInfo;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  callHistory: CallRecord[];
  onRefreshCalls: () => void;
  onStartCall: (type: "audio" | "video") => void;
  onClearUnread: () => void;
}

function VoiceNotePlayer({
  url,
  durationSec,
  isMine,
}: {
  url: string;
  durationSec: number | null;
  isMine: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState(durationSec || 0);
  const [rate, setRate] = useState<1 | 1.5>(1);

  const bars = [38, 66, 52, 85, 92, 48, 74, 60, 95, 70, 44, 82, 64, 55, 88, 50, 72, 42];

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.playbackRate = rate;
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }

  function toggleRate() {
    const next = rate === 1 ? 1.5 : 1;
    setRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  }

  return (
    <div className="flex items-center gap-2.5 min-w-[210px] sm:min-w-[245px] py-1">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setTotalSec(Math.round(d));
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setCurrentSec(el.currentTime);
          if (Number.isFinite(el.duration) && el.duration > 0) {
            setProgress((el.currentTime / el.duration) * 100);
          }
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentSec(0);
        }}
      />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition active:scale-95 ${
          isMine
            ? "bg-white text-[#E84A7F]"
            : "bg-forever-gradient text-white"
        }`}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-[3px] h-6">
          {bars.map((h, i) => {
            const pct = ((i + 1) / bars.length) * 100;
            const active = pct <= progress;
            return (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-full transition-colors ${
                  isMine
                    ? active
                      ? "bg-white"
                      : "bg-white/35"
                    : active
                    ? "bg-[#E84A7F]"
                    : "bg-rose-300/50 dark:bg-rose-400/30"
                }`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-80">
          <span>
            {formatDuration(playing || currentSec > 0 ? currentSec : totalSec)}
          </span>
          <button
            type="button"
            onClick={toggleRate}
            className={`rounded px-1.5 py-0.2 font-bold ${
              isMine ? "bg-white/20" : "bg-rose-500/15 text-[#E84A7F]"
            }`}
          >
            {rate}x
          </button>
        </div>
      </div>
    </div>
  );
}

export function PrivateChatScreen({
  user,
  partner,
  couple,
  messages,
  setMessages,
  callHistory,
  onRefreshCalls,
  onStartCall,
  onClearUnread,
}: PrivateChatScreenProps) {
  const [inputText, setInputText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<"none" | "emoji" | "sticker">("none");
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{
    url: string;
    downloadUrl: string;
    type: "image" | "video";
    caption: string;
  } | null>(null);
  const [showCallHistory, setShowCallHistory] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRecordingRef = useRef(false);

  // Decrypted cache for E2EE messages
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const lastTypingPingRef = useRef(0);

  // Mark messages read on mount & whenever new incoming messages arrive while viewing chat
  useEffect(() => {
    const hasUnread = messages.some(
      (m) => m.senderId !== user.id && m.status !== "read"
    );
    if (hasUnread || messages.length === 0) {
      apiFetch<{ messages: ChatMessage[] }>("/api/messages?markRead=1")
        .then((data) => {
          setMessages(data.messages);
          onClearUnread();
        })
        .catch(() => {});
    } else {
      onClearUnread();
    }
  }, [messages.length, user.id, setMessages, onClearUnread]);

  // Decrypt any E2EE messages automatically
  useEffect(() => {
    let active = true;
    async function runDecrypt() {
      const encrypted = messages.filter(
        (m) => m.isEncrypted && m.encryptionIv && !decryptedMap[m.id]
      );
      if (encrypted.length === 0) return;

      const entries: Array<[string, string]> = [];
      for (const m of encrypted) {
        const plain = await decryptCoupleText(
          m.content,
          m.encryptionIv!,
          couple.id,
          couple.e2eeSalt
        );
        entries.push([m.id, plain]);
      }
      if (active && entries.length > 0) {
        setDecryptedMap((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      }
    }
    runDecrypt();
    return () => {
      active = false;
    };
  }, [messages, couple.id, couple.e2eeSalt, decryptedMap]);

  // Auto-scroll to newest message
  useEffect(() => {
    if (!searchQuery) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, partner?.isTyping, searchQuery]);

  // Cleanup recorder on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const getDisplayText = useCallback(
    (msg: ChatMessage) => {
      if (msg.isDeleted) return "This message was deleted";
      if (msg.isEncrypted) return decryptedMap[msg.id] ?? "Decrypting...";
      return msg.content;
    },
    [decryptedMap]
  );

  function notifyTyping(typing: boolean) {
    const now = Date.now();
    if (typing && now - lastTypingPingRef.current < 2400) return;
    lastTypingPingRef.current = typing ? now : 0;
    apiFetch("/api/messages/typing", {
      method: "POST",
      body: JSON.stringify({ isTyping: typing }),
    }).catch(() => {});
  }

  async function handleSendText(e?: React.FormEvent) {
    e?.preventDefault();
    const raw = inputText.trim();
    if (!raw || sending) return;
    setSending(true);
    setErrorBanner(null);

    try {
      let contentToSend = raw;
      let isEncrypted = false;
      let encryptionIv: string | null = null;

      if (couple.e2eeEnabled) {
        const enc = await encryptCoupleText(raw, couple.id, couple.e2eeSalt);
        contentToSend = enc.ciphertext;
        encryptionIv = enc.iv;
        isEncrypted = true;
      }

      if (editingMsg) {
        const res = await apiFetch<{
          message: {
            id: string;
            content: string;
            isEncrypted: boolean;
            encryptionIv: string | null;
            updatedAt: string;
          };
        }>(`/api/messages/${editingMsg.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            content: contentToSend,
            isEncrypted,
            encryptionIv,
          }),
        });
        if (isEncrypted) {
          setDecryptedMap((prev) => ({ ...prev, [editingMsg.id]: raw }));
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMsg.id
              ? {
                  ...m,
                  content: res.message.content,
                  isEncrypted: res.message.isEncrypted,
                  encryptionIv: res.message.encryptionIv,
                  isEdited: true,
                  updatedAt: res.message.updatedAt,
                }
              : m
          )
        );
        setEditingMsg(null);
      } else {
        const res = await apiFetch<{ message: ChatMessage }>("/api/messages", {
          method: "POST",
          body: JSON.stringify({
            messageType: "text",
            content: contentToSend,
            isEncrypted,
            encryptionIv,
            replyToId: replyTo?.id ?? null,
          }),
        });
        if (isEncrypted) {
          setDecryptedMap((prev) => ({ ...prev, [res.message.id]: raw }));
        }
        setMessages((prev) =>
          prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
        );
        setReplyTo(null);
      }

      setInputText("");
      setPickerTab("none");
      notifyTyping(false);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendSticker(stickerId: string, label: string) {
    setPickerTab("none");
    try {
      const res = await apiFetch<{ message: ChatMessage }>("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          messageType: "sticker",
          stickerId,
          content: label,
          replyToId: replyTo?.id ?? null,
        }),
      });
      setMessages((prev) => [...prev, res.message]);
      setReplyTo(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Failed to send sticker.");
    }
  }

  async function handleFileSelected(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "media" | "document"
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setAttachMenuOpen(false);
    if (!file) return;

    setErrorBanner(null);
    const isVideo = file.type.startsWith("video/");
    const uploadCategory =
      kind === "document" ? "document" : isVideo ? "video" : "image";
    const msgType =
      kind === "document" ? "document" : isVideo ? "video" : "image";

    setUploading(`Encrypting & uploading ${file.name}...`);
    try {
      const uploaded = await apiUploadMedia(file, uploadCategory);
      const res = await apiFetch<{ message: ChatMessage }>("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          messageType: msgType,
          mediaId: uploaded.id,
          content: inputText.trim() || "",
          replyToId: replyTo?.id ?? null,
        }),
      });
      setMessages((prev) => [...prev, res.message]);
      setInputText("");
      setReplyTo(null);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function startVoiceRecording() {
    setErrorBanner(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setErrorBanner("Voice recording is not supported on this device browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      discardRecordingRef.current = false;

      const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      const startedAt = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        setIsRecording(false);
        setRecordSeconds(0);

        if (discardRecordingRef.current || recordChunksRef.current.length === 0) {
          return;
        }

        const dur = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const baseMime = (recorder.mimeType || "audio/webm").split(";")[0];
        const ext = baseMime.includes("mp4")
          ? "m4a"
          : baseMime.includes("ogg")
          ? "ogg"
          : "webm";
        const blob = new Blob(recordChunksRef.current, { type: baseMime });
        const voiceFile = new File([blob], `voice-note-${Date.now()}.${ext}`, {
          type: baseMime,
        });

        setUploading("Sending private voice message...");
        try {
          const uploaded = await apiUploadMedia(voiceFile, "audio", dur);
          const res = await apiFetch<{ message: ChatMessage }>("/api/messages", {
            method: "POST",
            body: JSON.stringify({
              messageType: "voice",
              mediaId: uploaded.id,
              content: "Voice message",
              replyToId: replyTo?.id ?? null,
            }),
          });
          setMessages((prev) => [...prev, res.message]);
          setReplyTo(null);
        } catch (err) {
          setErrorBanner(
            err instanceof Error ? err.message : "Failed to send voice message."
          );
        } finally {
          setUploading(null);
        }
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setErrorBanner(
        "Microphone access denied. Please allow microphone permission to send voice notes."
      );
    }
  }

  function finishVoiceRecording(discard: boolean) {
    discardRecordingRef.current = discard;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      setIsRecording(false);
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    setActiveMenuMsgId(null);
    try {
      const res = await apiFetch<{
        messageId: string;
        reactions: Array<{ userId: string; emoji: string }>;
      }>(`/api/messages/${messageId}/react`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions: res.reactions } : m
        )
      );
    } catch {
      // ignore
    }
  }

  async function handleForward(msg: ChatMessage) {
    setActiveMenuMsgId(null);
    try {
      const res = await apiFetch<{ message: ChatMessage }>("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          messageType: msg.messageType,
          content: msg.isEncrypted ? getDisplayText(msg) : msg.content,
          stickerId: msg.stickerId,
          mediaId: msg.media?.id ?? null,
          isForwarded: true,
        }),
      });
      setMessages((prev) => [...prev, res.message]);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Could not forward message.");
    }
  }

  async function handleDelete(messageId: string) {
    setActiveMenuMsgId(null);
    try {
      await apiFetch(`/api/messages/${messageId}`, { method: "DELETE" });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                isDeleted: true,
                content: "This message was deleted",
                media: null,
                stickerId: null,
                reactions: [],
              }
            : m
        )
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Could not delete message.");
    }
  }

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) => {
        if (m.isDeleted) return false;
        const q = searchQuery.toLowerCase();
        return (
          getDisplayText(m).toLowerCase().includes(q) ||
          (m.media?.originalName.toLowerCase().includes(q) ?? false)
        );
      })
    : messages;

  return (
    <div className="flex flex-col h-[calc(100dvh-8.2rem)] rounded-3xl overflow-hidden bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] shadow-sm">
      {/* WhatsApp-Style Chat Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-white dark:bg-[#161B36] border-b border-[#F3DCE6] dark:border-[#27305C] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            src={partner?.avatarUrl}
            name={partner?.displayName || "Spouse"}
            role={partner?.role || (user.role === "husband" ? "wife" : "husband")}
            isOnline={partner?.isOnline}
            showStatus
            size="md"
          />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#141124] dark:text-white truncate">
              {partner?.displayName || "Your Spouse"}
            </h2>
            <p
              className={`text-xs truncate ${
                partner?.isTyping
                  ? "text-[#E84A7F] font-semibold animate-pulse"
                  : partner?.isOnline
                  ? "text-emerald-600 dark:text-emerald-400 font-medium"
                  : "text-[#625673] dark:text-[#A6A0C4]"
              }`}
            >
              {partner
                ? formatLastSeen(
                    partner.lastSeenAt,
                    partner.isOnline,
                    partner.isTyping
                  )
                : "Private Sanctuary"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSearchOpen((v) => !v);
              setSearchQuery("");
            }}
            title="Search chat history"
            className={`p-2.5 rounded-xl transition ${
              searchOpen
                ? "bg-rose-50 dark:bg-rose-500/20 text-[#E84A7F]"
                : "text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548]"
            }`}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStartCall("audio")}
            title="Start Audio Call"
            className="p-2.5 rounded-xl text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548] hover:text-[#E84A7F] transition"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onStartCall("video")}
            title="Start Video Call"
            className="p-2.5 rounded-xl text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548] hover:text-[#E84A7F] transition"
          >
            <Video className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              onRefreshCalls();
              setShowCallHistory(true);
            }}
            title="Call History"
            className="p-2.5 rounded-xl text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548] hover:text-[#E84A7F] transition"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsible Search Bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF8FA] dark:bg-[#12162E] px-4 py-2.5 shrink-0"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-rose-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages, captions, or shared files..."
                className="flex-1 bg-transparent text-sm outline-none text-[#141124] dark:text-white placeholder:text-slate-400"
              />
              {searchQuery && (
                <span className="text-xs font-semibold text-[#E84A7F]">
                  {filteredMessages.length} found
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-rose-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Thread */}
      <div
        onClick={() => {
          setActiveMenuMsgId(null);
          setAttachMenuOpen(false);
        }}
        className="flex-1 overflow-y-auto chat-wallpaper px-3 sm:px-5 py-4 space-y-3"
      >
        {/* Encryption Notice Pill */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/90 dark:bg-[#161B36]/90 border border-[#F3DCE6] dark:border-[#27305C] px-3.5 py-1.5 text-[11px] text-[#625673] dark:text-[#A6A0C4] shadow-2xs">
            <Lock className="w-3 h-3 text-[#E84A7F]" />
            <span>
              {couple.e2eeEnabled
                ? "AES-256-GCM End-to-End Encrypted"
                : `Private to ${couple.coupleName} · Protected Media`}
            </span>
          </div>
        </div>

        {filteredMessages.map((msg) => {
          const isMine = msg.senderId === user.id;
          const displayText = getDisplayText(msg);
          const sticker = msg.stickerId
            ? COUPLE_STICKERS.find((s) => s.id === msg.stickerId)
            : null;
          const menuOpen = activeMenuMsgId === msg.id;

          if (msg.messageType === "affection" && !msg.isDeleted) {
            return (
              <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center py-1">
                <div className="max-w-[85%] rounded-2xl bg-gradient-to-r from-rose-50 via-pink-50 to-purple-50 dark:from-rose-500/15 dark:via-fuchsia-500/15 dark:to-purple-500/15 border border-rose-200/80 dark:border-rose-400/25 px-4 py-2 text-center shadow-2xs">
                  <p className="text-xs font-semibold text-[#5B1E6E] dark:text-rose-200">
                    {displayText}
                  </p>
                  <span className="text-[10px] text-[#625673] dark:text-[#A6A0C4]">
                    {formatChatTime(msg.createdAt)}
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`group relative flex ${
                isMine ? "justify-end" : "justify-start"
              } ${msg.reactions.length > 0 ? "mb-5" : ""}`}
            >
              <div
                className={`relative max-w-[84%] sm:max-w-[72%] ${
                  isMine ? "items-end" : "items-start"
                }`}
              >
                {/* Sticker Bubble */}
                {msg.messageType === "sticker" && sticker && !msg.isDeleted ? (
                  <div
                    className={`relative rounded-3xl bg-gradient-to-br ${sticker.gradient} p-4 text-white shadow-lg min-w-[165px] text-center`}
                  >
                    <div className="text-5xl mb-1.5 drop-shadow">{sticker.emoji}</div>
                    <p className="text-sm font-extrabold tracking-tight">
                      {sticker.label}
                    </p>
                    <p className="text-[11px] text-white/80">{sticker.subtitle}</p>
                    <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-white/80">
                      <span>{formatChatTime(msg.createdAt)}</span>
                      {isMine &&
                        (msg.status === "read" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
                        ) : msg.status === "delivered" ? (
                          <CheckCheck className="w-3.5 h-3.5 text-white/75" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-white/75" />
                        ))}
                    </div>
                  </div>
                ) : (
                  /* Standard / Media / Voice / Document Bubble */
                  <div
                    className={`relative rounded-2xl px-3.5 py-2.5 shadow-xs ${
                      isMine
                        ? "bg-gradient-to-br from-[#E84A7F] to-[#8F286C] text-white rounded-br-sm"
                        : "bg-white dark:bg-[#1C2344] text-[#141124] dark:text-white border border-[#F3DCE6] dark:border-[#2C3563] rounded-bl-sm"
                    } ${msg.isDeleted ? "opacity-70 italic" : ""}`}
                  >
                    {/* Forwarded label */}
                    {msg.isForwarded && !msg.isDeleted && (
                      <div
                        className={`flex items-center gap-1 text-[10px] italic mb-1 ${
                          isMine ? "text-rose-100" : "text-[#625673] dark:text-[#A6A0C4]"
                        }`}
                      >
                        <Forward className="w-3 h-3" />
                        <span>Forwarded</span>
                      </div>
                    )}

                    {/* Quoted Reply Preview */}
                    {msg.replyTo && !msg.isDeleted && (
                      <button
                        type="button"
                        onClick={() => {
                          document
                            .getElementById(`msg-${msg.replyTo?.id}`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className={`w-full text-left rounded-xl px-2.5 py-1.5 mb-2 border-l-3 text-xs ${
                          isMine
                            ? "bg-black/20 border-white/80 text-rose-50"
                            : "bg-rose-50/80 dark:bg-[#121731] border-[#E84A7F] text-[#625673] dark:text-[#B8B2D6]"
                        }`}
                      >
                        <p className="font-bold text-[11px]">
                          {msg.replyTo.senderId === user.id
                            ? "You"
                            : partner?.displayName.split(" ")[0] || "Spouse"}
                        </p>
                        <p className="line-clamp-1 opacity-90">
                          {msg.replyTo.isEncrypted
                            ? "🔒 Encrypted message"
                            : msg.replyTo.content || msg.replyTo.messageType}
                        </p>
                      </button>
                    )}

                    {/* Image Attachment */}
                    {msg.messageType === "image" && msg.media && !msg.isDeleted && (
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxMedia({
                            url: msg.media!.url,
                            downloadUrl: msg.media!.downloadUrl,
                            type: "image",
                            caption: displayText,
                          })
                        }
                        className="block rounded-xl overflow-hidden mb-1.5 max-w-[260px] sm:max-w-[300px]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.media.url}
                          alt={msg.media.originalName}
                          className="w-full max-h-64 object-cover hover:scale-[1.02] transition-transform"
                        />
                      </button>
                    )}

                    {/* Video Attachment */}
                    {msg.messageType === "video" && msg.media && !msg.isDeleted && (
                      <div className="rounded-xl overflow-hidden mb-1.5 max-w-[270px] sm:max-w-[310px]">
                        <video
                          src={msg.media.url}
                          controls
                          playsInline
                          className="w-full max-h-64 rounded-xl bg-black"
                        />
                      </div>
                    )}

                    {/* Voice Message */}
                    {msg.messageType === "voice" && msg.media && !msg.isDeleted && (
                      <VoiceNotePlayer
                        url={msg.media.url}
                        durationSec={msg.media.durationSec}
                        isMine={isMine}
                      />
                    )}

                    {/* PDF / Document Attachment */}
                    {msg.messageType === "document" && msg.media && !msg.isDeleted && (
                      <a
                        href={msg.media.downloadUrl}
                        download={msg.media.originalName}
                        className={`flex items-center gap-3 rounded-xl p-2.5 mb-1 min-w-[210px] transition ${
                          isMine
                            ? "bg-black/20 hover:bg-black/30 text-white"
                            : "bg-rose-50 dark:bg-[#121731] hover:bg-rose-100 text-[#141124] dark:text-white"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#E84A7F] text-white flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">
                            {msg.media.originalName}
                          </p>
                          <p className="text-[10px] opacity-75">
                            {formatBytes(msg.media.sizeBytes)} · Private File
                          </p>
                        </div>
                        <Download className="w-4 h-4 shrink-0 opacity-80" />
                      </a>
                    )}

                    {/* Text / Caption */}
                    {(msg.isDeleted ||
                      (msg.messageType !== "voice" && displayText)) && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                        {displayText}
                      </p>
                    )}

                    {/* Timestamp, Edited & Read Receipts */}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                        isMine
                          ? "text-rose-100/85"
                          : "text-[#625673] dark:text-[#A6A0C4]"
                      }`}
                    >
                      {msg.isEncrypted && !msg.isDeleted && (
                        <Lock className="w-2.5 h-2.5 opacity-80" />
                      )}
                      {msg.isEdited && !msg.isDeleted && <span>edited ·</span>}
                      <span>{formatChatTime(msg.createdAt)}</span>
                      {isMine && !msg.isDeleted && (
                        <span title={`Status: ${msg.status}`}>
                          {msg.status === "read" ? (
                            <CheckCheck className="w-3.5 h-3.5 text-sky-200 stroke-[2.5]" />
                          ) : msg.status === "delivered" ? (
                            <CheckCheck className="w-3.5 h-3.5 text-white/75" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-white/75" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Message Action Trigger */}
                {!msg.isDeleted && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuMsgId(menuOpen ? null : msg.id);
                    }}
                    aria-label="Message options"
                    className={`absolute top-1 ${
                      isMine ? "-left-8" : "-right-8"
                    } p-1.5 rounded-full bg-white/90 dark:bg-[#1E2548]/90 text-[#625673] dark:text-[#A6A0C4] shadow-xs opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition`}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Reaction Badges */}
                {msg.reactions.length > 0 && (
                  <div
                    className={`absolute -bottom-3.5 ${
                      isMine ? "right-2" : "left-2"
                    } inline-flex items-center gap-0.5 rounded-full bg-white dark:bg-[#232B54] border border-[#F3DCE6] dark:border-[#343F73] px-2 py-0.5 shadow-sm text-xs`}
                  >
                    {msg.reactions.map((rx) => (
                      <button
                        key={`${rx.userId}-${rx.emoji}`}
                        type="button"
                        onClick={() => handleReact(msg.id, rx.emoji)}
                        className="hover:scale-110 transition"
                      >
                        {rx.emoji}
                      </button>
                    ))}
                  </div>
                )}

                {/* Reaction + Reply/Forward/Edit/Delete Popover */}
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute z-30 mt-1.5 ${
                        isMine ? "right-0" : "left-0"
                      } rounded-2xl bg-white dark:bg-[#1E2548] border border-[#F3DCE6] dark:border-[#323C6E] shadow-xl p-2 min-w-[215px]`}
                    >
                      <div className="flex items-center justify-between gap-1 pb-2 mb-1.5 border-b border-[#F3DCE6] dark:border-[#2C3563]">
                        {REACTION_EMOJIS.map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => handleReact(msg.id, em)}
                            className="text-lg hover:scale-125 active:scale-95 transition px-0.5"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(msg);
                            setEditingMsg(null);
                            setActiveMenuMsgId(null);
                          }}
                          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 hover:bg-rose-50 dark:hover:bg-[#161B36] text-[#141124] dark:text-white"
                        >
                          <Reply className="w-3.5 h-3.5 text-[#E84A7F]" />
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => handleForward(msg)}
                          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 hover:bg-rose-50 dark:hover:bg-[#161B36] text-[#141124] dark:text-white"
                        >
                          <Forward className="w-3.5 h-3.5 text-purple-500" />
                          Forward
                        </button>
                        {isMine && msg.messageType === "text" && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMsg(msg);
                              setReplyTo(null);
                              setInputText(displayText);
                              setActiveMenuMsgId(null);
                            }}
                            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 hover:bg-rose-50 dark:hover:bg-[#161B36] text-[#141124] dark:text-white"
                          >
                            <Pencil className="w-3.5 h-3.5 text-amber-500" />
                            Edit
                          </button>
                        )}
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => handleDelete(msg.id)}
                            className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 hover:bg-rose-50 dark:hover:bg-[#161B36] text-rose-600 dark:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}

        {/* Partner Live Typing Bubble */}
        {partner?.isTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white dark:bg-[#1C2344] border border-[#F3DCE6] dark:border-[#2C3563] px-4 py-3 shadow-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#E84A7F] animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-[#E84A7F] animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-[#E84A7F] animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Status / Error / Reply / Edit Banners */}
      {(uploading || errorBanner || replyTo || editingMsg) && (
        <div className="px-4 py-2 bg-[#FFF8FA] dark:bg-[#12162E] border-t border-[#F3DCE6] dark:border-[#27305C] text-xs shrink-0">
          {uploading && (
            <p className="text-[#E84A7F] font-semibold animate-pulse">{uploading}</p>
          )}
          {errorBanner && (
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-300 font-medium">
              <span>{errorBanner}</span>
              <button type="button" onClick={() => setErrorBanner(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {(replyTo || editingMsg) && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 border-l-3 border-[#E84A7F] pl-2.5">
                <p className="font-bold text-[#E84A7F]">
                  {editingMsg
                    ? "Editing message"
                    : `Replying to ${
                        replyTo?.senderId === user.id
                          ? "yourself"
                          : partner?.displayName.split(" ")[0] || "Spouse"
                      }`}
                </p>
                <p className="truncate text-[#625673] dark:text-[#A6A0C4]">
                  {editingMsg
                    ? getDisplayText(editingMsg)
                    : replyTo
                    ? getDisplayText(replyTo)
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null);
                  if (editingMsg) {
                    setEditingMsg(null);
                    setInputText("");
                  }
                }}
                className="p-1 text-slate-400 hover:text-rose-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Emoji & Sticker Drawer */}
      <AnimatePresence>
        {pickerTab !== "none" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#F3DCE6] dark:border-[#27305C] bg-white dark:bg-[#161B36] px-3 py-3 shrink-0 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPickerTab("emoji")}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    pickerTab === "emoji"
                      ? "bg-forever-gradient text-white"
                      : "bg-rose-50 dark:bg-[#1E2548] text-[#625673] dark:text-[#A6A0C4]"
                  }`}
                >
                  Emojis
                </button>
                <button
                  type="button"
                  onClick={() => setPickerTab("sticker")}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    pickerTab === "sticker"
                      ? "bg-forever-gradient text-white"
                      : "bg-rose-50 dark:bg-[#1E2548] text-[#625673] dark:text-[#A6A0C4]"
                  }`}
                >
                  Love Stickers
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPickerTab("none")}
                className="p-1 text-slate-400 hover:text-rose-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pickerTab === "emoji" ? (
              <div className="grid grid-cols-8 gap-1 max-h-36 overflow-y-auto">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setInputText((prev) => prev + em)}
                    className="text-2xl py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-[#1E2548] active:scale-90 transition"
                  >
                    {em}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto">
                {COUPLE_STICKERS.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSendSticker(st.id, st.label)}
                    className={`rounded-2xl bg-gradient-to-br ${st.gradient} p-2.5 text-white text-center hover:brightness-110 active:scale-95 transition shadow-xs`}
                  >
                    <div className="text-2xl">{st.emoji}</div>
                    <p className="text-[11px] font-bold truncate mt-0.5">{st.label}</p>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Inputs */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        onChange={(e) => handleFileSelected(e, "media")}
        className="hidden"
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain"
        onChange={(e) => handleFileSelected(e, "document")}
        className="hidden"
      />

      {/* Bottom Message Composer */}
      <div className="relative px-3 py-2.5 bg-white dark:bg-[#161B36] border-t border-[#F3DCE6] dark:border-[#27305C] shrink-0">
        {/* Attachment popup */}
        <AnimatePresence>
          {attachMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="absolute bottom-16 left-4 z-30 rounded-2xl bg-white dark:bg-[#1E2548] border border-[#F3DCE6] dark:border-[#323C6E] shadow-xl p-2 space-y-1 min-w-[190px]"
            >
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-[#161B36] text-[#141124] dark:text-white"
              >
                <span className="w-8 h-8 rounded-xl bg-rose-500/15 text-[#E84A7F] flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </span>
                Photo or Video
              </button>
              <button
                type="button"
                onClick={() => docInputRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-[#161B36] text-[#141124] dark:text-white"
              >
                <span className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </span>
                PDF or Document
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {isRecording ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-rose-50 dark:bg-rose-500/15 px-4 py-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
              <span className="font-mono text-sm font-bold text-rose-600 dark:text-rose-300">
                {formatDuration(recordSeconds)}
              </span>
              <span className="text-xs text-[#625673] dark:text-[#A6A0C4]">
                Recording voice note...
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => finishVoiceRecording(true)}
                className="p-2 rounded-xl text-slate-500 hover:text-rose-600 transition"
                title="Cancel recording"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => finishVoiceRecording(false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-forever-gradient px-3.5 py-2 text-xs font-bold text-white shadow-md"
              >
                <Square className="w-3 h-3 fill-white" />
                Send Voice
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setPickerTab((prev) => (prev === "none" ? "emoji" : "none"))
              }
              className="p-2.5 rounded-xl text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548] hover:text-[#E84A7F] transition shrink-0"
              title="Emojis & Stickers"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setAttachMenuOpen((v) => !v)}
              className="p-2.5 rounded-xl text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548] hover:text-[#E84A7F] transition shrink-0"
              title="Share Photo, Video or Document"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                notifyTyping(e.target.value.trim().length > 0);
              }}
              placeholder="Write a loving message..."
              className="flex-1 min-w-0 rounded-2xl bg-[#FFF5F8] dark:bg-[#0D1126] border border-[#F3DCE6] dark:border-[#27305C] px-4 py-2.5 text-sm text-[#141124] dark:text-white placeholder:text-[#8E82A0] outline-none focus:border-[#E84A7F] transition"
            />

            {inputText.trim() ? (
              <button
                type="submit"
                disabled={sending}
                aria-label="Send message"
                className="w-11 h-11 rounded-2xl bg-forever-gradient text-white flex items-center justify-center shadow-md shadow-rose-500/25 active:scale-95 transition shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceRecording}
                aria-label="Record voice message"
                title="Record voice message"
                className="w-11 h-11 rounded-2xl bg-forever-gradient text-white flex items-center justify-center shadow-md shadow-rose-500/25 active:scale-95 transition shrink-0"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Photo Lightbox Modal */}
      <AnimatePresence>
        {lightboxMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxMedia(null)}
            className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          >
            <div className="w-full max-w-2xl flex items-center justify-end gap-2 mb-3">
              <a
                href={lightboxMedia.downloadUrl}
                download
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 px-4 py-2 text-xs font-semibold text-white"
              >
                <Download className="w-4 h-4" />
                Save Private Copy
              </a>
              <button
                type="button"
                onClick={() => setLightboxMedia(null)}
                className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxMedia.url}
              alt="Shared private photo"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[75dvh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            {lightboxMedia.caption && (
              <p className="mt-3 text-sm text-white/90 text-center max-w-lg">
                {lightboxMedia.caption}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call History Modal */}
      <AnimatePresence>
        {showCallHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCallHistory(false)}
            className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-2xl max-h-[75dvh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#F3DCE6] dark:border-[#27305C]">
                <h3 className="text-base font-bold text-[#141124] dark:text-white">
                  Private Call History
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCallHistory(false)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-rose-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#F3DCE6] dark:divide-[#27305C] my-2">
                {callHistory.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[#625673] dark:text-[#A6A0C4]">
                    No calls yet. Start a private audio or video call anytime ❤️
                  </p>
                ) : (
                  callHistory.map((call) => {
                    const outgoing = call.callerId === user.id;
                    const missed =
                      call.status === "missed" || call.status === "rejected";
                    return (
                      <div
                        key={call.id}
                        className="flex items-center justify-between py-3 gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                              missed
                                ? "bg-rose-50 dark:bg-rose-500/15 text-rose-500"
                                : "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {missed ? (
                              <PhoneMissed className="w-4 h-4" />
                            ) : outgoing ? (
                              <PhoneOutgoing className="w-4 h-4" />
                            ) : (
                              <PhoneIncoming className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#141124] dark:text-white capitalize">
                              {outgoing ? "Outgoing" : "Incoming"} {call.callType} Call
                            </p>
                            <p className="text-xs text-[#625673] dark:text-[#A6A0C4]">
                              {formatRelativeTime(call.startedAt)} ·{" "}
                              {call.status === "ended"
                                ? formatDuration(call.durationSec)
                                : call.status}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCallHistory(false);
                            onStartCall(call.callType);
                          }}
                          className="p-2 rounded-xl bg-rose-50 dark:bg-[#1E2548] text-[#E84A7F] hover:brightness-95"
                        >
                          {call.callType === "video" ? (
                            <Video className="w-4 h-4" />
                          ) : (
                            <Phone className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
