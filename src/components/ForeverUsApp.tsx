"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  MessageCircleHeart,
  Heart,
  Images,
  UserCircle2,
  Bell,
  CalendarHeart,
  Moon,
  Sun,
  CheckCheck,
  X,
} from "lucide-react";
import { AnimatedHeartLogo } from "./AnimatedHeartLogo";
import { SplashScreen } from "./SplashScreen";
import { AuthScreen } from "./AuthScreen";
import { ConnectPartnerScreen } from "./ConnectPartnerScreen";
import { HomeDashboard } from "./HomeDashboard";
import { PrivateChatScreen } from "./PrivateChatScreen";
import { CallOverlay } from "./CallOverlay";
import { MemoriesScreen } from "./MemoriesScreen";
import { LoveZoneScreen } from "./LoveZoneScreen";
import { CoupleGamesScreen } from "./CoupleGamesScreen";
import { SharedCalendarScreen } from "./SharedCalendarScreen";
import { ProfileSettingsScreen } from "./ProfileSettingsScreen";
import { AffectionBurstOverlay } from "./AffectionBurstOverlay";
import {
  apiFetch,
  getTabSessionToken,
  setTabSessionToken,
  formatRelativeTime,
} from "@/lib/api-client";
import type {
  UserProfile,
  CoupleInfo,
  ChatMessage,
  CallRecord,
  MemoryItem,
  CalendarEventItem,
  NotificationItem,
  AffectionBurst,
  ActiveScreen,
} from "@/lib/types";

interface CallSignalItem {
  id: string;
  senderId: string;
  signalType: string;
  payload: string;
}

export function ForeverUsApp() {
  const [showSplash, setShowSplash] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [couple, setCouple] = useState<CoupleInfo | null>(null);
  const [partner, setPartner] = useState<UserProfile | null>(null);

  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("home");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const [activeCall, setActiveCall] = useState<CallRecord | null>(null);
  const [callSignals, setCallSignals] = useState<CallSignalItem[]>([]);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unopenedSurprises, setUnopenedSurprises] = useState(0);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);

  const [burst, setBurst] = useState<AffectionBurst | null>(null);
  const [loveRefreshTick, setLoveRefreshTick] = useState(0);
  const [gamesRefreshTick, setGamesRefreshTick] = useState(0);

  const activeScreenRef = useRef<ActiveScreen>(activeScreen);
  activeScreenRef.current = activeScreen;
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync dark/light class onto <html>
  useEffect(() => {
    const root = document.documentElement;
    if (user?.theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [user?.theme]);

  const triggerBurst = useCallback((b: AffectionBurst) => {
    setBurst(b);
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => {
      setBurst(null);
    }, 3600);
  }, []);

  const loadCoupleWorkspace = useCallback(async (myUserId: string) => {
    try {
      const [msgRes, memRes, calRes, callRes, notifRes, loveRes] =
        await Promise.all([
          apiFetch<{ messages: ChatMessage[]; partner: UserProfile | null }>(
            "/api/messages"
          ),
          apiFetch<{ memories: MemoryItem[] }>("/api/memories"),
          apiFetch<{ events: CalendarEventItem[] }>("/api/calendar"),
          apiFetch<{ activeCall: CallRecord | null; calls: CallRecord[] }>(
            "/api/calls"
          ),
          apiFetch<{ notifications: NotificationItem[] }>("/api/notifications"),
          apiFetch<{
            surprises: Array<{ senderId: string; isOpened: boolean }>;
          }>("/api/love-zone"),
        ]);

      setMessages(msgRes.messages);
      if (msgRes.partner) setPartner(msgRes.partner);
      setMemories(memRes.memories);
      setCalendarEvents(calRes.events);
      setCallHistory(callRes.calls);
      if (callRes.activeCall) setActiveCall(callRes.activeCall);
      setNotifications(notifRes.notifications);
      setUnreadNotifications(
        notifRes.notifications.filter((n) => !n.isRead).length
      );
      setUnreadMessages(
        msgRes.messages.filter(
          (m) => m.senderId !== myUserId && m.status !== "read" && !m.isDeleted
        ).length
      );
      setUnopenedSurprises(
        loveRes.surprises.filter((s) => s.senderId !== myUserId && !s.isOpened)
          .length
      );
    } catch {
      // ignore transient errors
    }
  }, []);

  // Initial session check & splash transition
  useEffect(() => {
    let mounted = true;
    const minSplash = new Promise((r) => setTimeout(r, 1150));

    async function init() {
      try {
        const [me] = await Promise.all([
          apiFetch<{
            user: UserProfile | null;
            couple: CoupleInfo | null;
            partner: UserProfile | null;
            unreadNotifications?: number;
            unreadMessages?: number;
          }>("/api/auth/me"),
          minSplash,
        ]);

        if (!mounted) return;
        setUser(me.user);
        setCouple(me.couple);
        setPartner(me.partner);
        setUnreadNotifications(me.unreadNotifications ?? 0);
        setUnreadMessages(me.unreadMessages ?? 0);

        if (me.user && me.couple?.isComplete) {
          loadCoupleWorkspace(me.user.id);
        }
      } catch {
        // remain unauthenticated
      } finally {
        if (mounted) {
          setBootstrapped(true);
          setShowSplash(false);
        }
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [loadCoupleWorkspace]);

  // Real-time Server-Sent Events subscription
  useEffect(() => {
    if (!user) return;

    const tabToken = getTabSessionToken();
    const sseUrl = tabToken
      ? `/api/realtime?token=${encodeURIComponent(tabToken)}`
      : "/api/realtime";

    const es = new EventSource(sseUrl, { withCredentials: true });

    es.addEventListener("presence", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        setPartner((prev) =>
          prev && prev.id === d.userId
            ? {
                ...prev,
                isOnline: d.isOnline,
                lastSeenAt: d.lastSeenAt || prev.lastSeenAt,
                isTyping: d.isTyping ?? prev.isTyping,
              }
            : prev
        );
      } catch {}
    });

    es.addEventListener("typing", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        setPartner((prev) =>
          prev && prev.id === d.userId ? { ...prev, isTyping: d.isTyping, isOnline: true } : prev
        );
        if (typingResetRef.current) clearTimeout(typingResetRef.current);
        if (d.isTyping) {
          typingResetRef.current = setTimeout(() => {
            setPartner((prev) => (prev ? { ...prev, isTyping: false } : prev));
          }, 5500);
        }
      } catch {}
    });

    es.addEventListener("partner:updated", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        if (d.partner) setPartner(d.partner);
      } catch {}
    });

    es.addEventListener("couple:connected", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        if (d.couple) setCouple(d.couple);
        if (d.partner) setPartner(d.partner);
        triggerBurst({
          id: String(Date.now()),
          emoji: "💍",
          title: "Hearts Connected Forever!",
          note: `${d.partner?.displayName || "Your spouse"} just joined your private sanctuary ❤️`,
        });
        loadCoupleWorkspace(user.id);
      } catch {}
    });

    es.addEventListener("couple:updated", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        if (d.couple) setCouple(d.couple);
      } catch {}
    });

    es.addEventListener("message:new", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { message: ChatMessage };
        setMessages((prev) =>
          prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message]
        );
        setPartner((prev) => (prev ? { ...prev, isTyping: false } : prev));
        if (activeScreenRef.current !== "chat") {
          setUnreadMessages((c) => c + 1);
        }
      } catch {}
    });

    es.addEventListener("message:updated", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === d.id
              ? {
                  ...m,
                  content: d.content,
                  isEncrypted: d.isEncrypted,
                  encryptionIv: d.encryptionIv,
                  isEdited: true,
                  updatedAt: d.updatedAt,
                }
              : m
          )
        );
      } catch {}
    });

    es.addEventListener("message:deleted", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === d.id
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
      } catch {}
    });

    es.addEventListener("message:reacted", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === d.messageId ? { ...m, reactions: d.reactions } : m
          )
        );
      } catch {}
    });

    es.addEventListener("messages:read", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as {
          messageIds: string[];
          readAt: string;
        };
        const idSet = new Set(d.messageIds);
        setMessages((prev) =>
          prev.map((m) =>
            idSet.has(m.id) ? { ...m, status: "read", readAt: d.readAt } : m
          )
        );
      } catch {}
    });

    es.addEventListener("messages:delivered", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as {
          messageIds: string[];
          deliveredAt: string;
        };
        const idSet = new Set(d.messageIds);
        setMessages((prev) =>
          prev.map((m) =>
            idSet.has(m.id) && m.status === "sent"
              ? { ...m, status: "delivered", deliveredAt: d.deliveredAt }
              : m
          )
        );
      } catch {}
    });

    es.addEventListener("call:incoming", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as {
          call: CallRecord;
          callerName: string;
        };
        setCallSignals([]);
        setActiveCall(d.call);
        if (
          user.notificationsEnabled &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(`Forever Us ❤️ — ${d.callerName}`, {
            body: `Incoming private ${d.call.callType} call`,
            icon: "/icons/app-icon.png",
          });
        }
      } catch {}
    });

    es.addEventListener("call:updated", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { call: CallRecord };
        if (d.call.status === "active" || d.call.status === "ringing") {
          setActiveCall(d.call);
        } else {
          setActiveCall(null);
          setCallSignals([]);
          apiFetch<{ calls: CallRecord[] }>("/api/calls")
            .then((r) => setCallHistory(r.calls))
            .catch(() => {});
        }
      } catch {}
    });

    es.addEventListener("call:signal", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as CallSignalItem;
        setCallSignals((prev) => [...prev, d]);
      } catch {}
    });

    es.addEventListener("affection:burst", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data);
        triggerBurst({
          id: d.id || String(Date.now()),
          emoji: d.emoji || "❤️",
          title: d.title || "Sweet Affection",
          note: d.note || "",
          senderName: d.senderName,
        });
        if (d.kind === "surprise") {
          setUnopenedSurprises((c) => c + 1);
        }
        setLoveRefreshTick((t) => t + 1);
      } catch {}
    });

    es.addEventListener("memory:new", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { memory: MemoryItem };
        setMemories((prev) =>
          prev.some((m) => m.id === d.memory.id) ? prev : [d.memory, ...prev]
        );
      } catch {}
    });

    es.addEventListener("memory:updated", () => {
      apiFetch<{ memories: MemoryItem[] }>("/api/memories")
        .then((r) => setMemories(r.memories))
        .catch(() => {});
    });

    es.addEventListener("memory:deleted", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as { id: string };
        setMemories((prev) => prev.filter((m) => m.id !== d.id));
      } catch {}
    });

    es.addEventListener("lovezone:updated", () => {
      setLoveRefreshTick((t) => t + 1);
    });

    es.addEventListener("games:updated", () => {
      setGamesRefreshTick((t) => t + 1);
    });

    es.addEventListener("calendar:updated", () => {
      apiFetch<{ events: CalendarEventItem[] }>("/api/calendar")
        .then((r) => setCalendarEvents(r.events))
        .catch(() => {});
    });

    es.addEventListener("notification:new", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data) as {
          notification: NotificationItem;
        };
        setNotifications((prev) => [d.notification, ...prev.slice(0, 29)]);
        setUnreadNotifications((c) => c + 1);
        if (
          user.notificationsEnabled &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted" &&
          document.hidden
        ) {
          new Notification(d.notification.title, {
            body: d.notification.body,
            icon: "/icons/app-icon.png",
          });
        }
      } catch {}
    });

    return () => {
      es.close();
    };
  }, [user, couple?.id, triggerBurst, loadCoupleWorkspace]);

  const handleStartCall = useCallback(async (type: "audio" | "video") => {
    try {
      setCallSignals([]);
      const res = await apiFetch<{ call: CallRecord }>("/api/calls", {
        method: "POST",
        body: JSON.stringify({ callType: type }),
      });
      setActiveCall(res.call);
    } catch {
      // ignore
    }
  }, []);

  const handleRefreshCalls = useCallback(() => {
    apiFetch<{ calls: CallRecord[] }>("/api/calls")
      .then((r) => setCallHistory(r.calls))
      .catch(() => {});
  }, []);

  const handleToggleTheme = useCallback(async () => {
    if (!user) return;
    const nextTheme = user.theme === "dark" ? "light" : "dark";
    setUser({ ...user, theme: nextTheme });
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ theme: nextTheme }),
      });
    } catch {
      // ignore
    }
  }, [user]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    setUnreadNotifications(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "mark_all_read" }),
      });
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setTabSessionToken(null);
    setUser(null);
    setCouple(null);
    setPartner(null);
    setMessages([]);
    setMemories([]);
    setCalendarEvents([]);
    setActiveCall(null);
    setActiveScreen("home");
    document.documentElement.classList.remove("dark");
  }, []);

  const clearUnread = useCallback(() => setUnreadMessages(0), []);

  // Screen 1: Splash Screen
  if (showSplash || !bootstrapped) {
    return (
      <AnimatePresence>
        <SplashScreen
          onContinue={() => {
            if (bootstrapped) setShowSplash(false);
          }}
        />
      </AnimatePresence>
    );
  }

  // Screen 2: Login / Register
  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={({ user: u, couple: c, partner: p }) => {
          setUser(u);
          setCouple(c);
          setPartner(p);
          setActiveScreen("home");
          if (c?.isComplete) {
            loadCoupleWorkspace(u.id);
          }
        }}
      />
    );
  }

  // Screen 3: Connect Partner via Private Invitation Code
  if (!couple || !couple.isComplete) {
    return (
      <>
        <AffectionBurstOverlay burst={burst} onDismiss={() => setBurst(null)} />
        <ConnectPartnerScreen
          user={user}
          couple={couple}
          onCoupleUpdated={setCouple}
          onConnected={({ user: u, couple: c, partner: p }) => {
            setUser(u);
            setCouple(c);
            setPartner(p);
            triggerBurst({
              id: String(Date.now()),
              emoji: "❤️",
              title: `Connected with ${p?.displayName || "Your Spouse"}!`,
              note: "Welcome to Forever Us — Two Hearts, One Private World.",
            });
            loadCoupleWorkspace(u.id);
          }}
          onLogout={handleLogout}
        />
      </>
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvent =
    calendarEvents.find((e) => e.eventDate >= todayIso) ??
    calendarEvents[0] ??
    null;

  const navItems: Array<{
    id: ActiveScreen;
    label: string;
    icon: typeof Home;
    badge?: number;
  }> = [
    { id: "home", label: "Home", icon: Home },
    {
      id: "chat",
      label: "Chat",
      icon: MessageCircleHeart,
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    },
    {
      id: "love",
      label: "Love Zone",
      icon: Heart,
      badge: unopenedSurprises > 0 ? unopenedSurprises : undefined,
    },
    { id: "memories", label: "Memories", icon: Images },
    { id: "profile", label: "Profile", icon: UserCircle2 },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-[#FFF8FA] dark:bg-[#0D1126] text-[#141124] dark:text-[#F9F6FC] transition-colors">
      {/* Animated Floating Roses / Kisses / Hugs / Hearts */}
      <AffectionBurstOverlay burst={burst} onDismiss={() => setBurst(null)} />

      {/* Screen 6: Full-Screen Audio & Video WebRTC Calling */}
      <CallOverlay
        call={activeCall}
        user={user}
        partner={partner}
        incomingSignals={callSignals}
        onCallUpdated={(updated) => {
          setActiveCall(updated);
          if (!updated) handleRefreshCalls();
        }}
        onSendHeartDuringCall={() => {
          apiFetch("/api/love-zone/affection", {
            method: "POST",
            body: JSON.stringify({
              kind: "sparkle",
              title: "In-Call Heart Shower",
              note: "Loving every second of seeing & hearing you ❤️",
              sendToChat: false,
            }),
          }).catch(() => {});
          triggerBurst({
            id: String(Date.now()),
            emoji: "💖",
            title: "Hearts Sent!",
            note: "Floating over your call together",
          });
        }}
      />

      {/* Minimal Premium Top App Bar */}
      <header className="sticky top-0 z-40 h-14 bg-white/85 dark:bg-[#12162E]/85 backdrop-blur-xl border-b border-[#F3DCE6] dark:border-[#242C54]">
        <div className="mx-auto max-w-2xl h-full px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveScreen("home")}
            className="flex items-center gap-2.5 text-left"
          >
            <AnimatedHeartLogo size="sm" />
            <div>
              <span className="font-serif text-base font-bold tracking-tight text-[#141124] dark:text-white">
                FOREVER US <span className="text-[#E84A7F]">❤️</span>
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveScreen("calendar")}
              title="Shared Calendar"
              className={`p-2 rounded-xl transition ${
                activeScreen === "calendar"
                  ? "bg-rose-50 dark:bg-rose-500/20 text-[#E84A7F]"
                  : "text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548]"
              }`}
            >
              <CalendarHeart className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              title="Toggle Dark / Light Theme"
              className="p-2 rounded-xl text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548] transition"
            >
              {user.theme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-300" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowNotifDrawer((v) => !v)}
              title="Notifications"
              className="relative p-2 rounded-xl text-[#625673] dark:text-[#A6A0C4] hover:bg-rose-50 dark:hover:bg-[#1E2548] transition"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-[#E84A7F] text-white text-[10px] font-extrabold flex items-center justify-center px-1">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Notification Feed Drawer */}
      <AnimatePresence>
        {showNotifDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowNotifDrawer(false)}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-center items-start pt-16 px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] shadow-2xl p-4 max-h-[70dvh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#F3DCE6] dark:border-[#27305C]">
                <h3 className="text-sm font-bold text-[#141124] dark:text-white">
                  Love Alerts & Notifications
                </h3>
                <div className="flex items-center gap-2">
                  {unreadNotifications > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#E84A7F]"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark Read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNotifDrawer(false)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#F3DCE6] dark:divide-[#27305C] mt-1">
                {notifications.length === 0 ? (
                  <p className="py-10 text-center text-xs text-[#625673] dark:text-[#A6A0C4]">
                    All caught up in your private world ❤️
                  </p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setShowNotifDrawer(false);
                        if (n.kind === "message" || n.kind === "call") {
                          setActiveScreen("chat");
                        } else if (n.kind === "memory") {
                          setActiveScreen("memories");
                        } else if (n.kind === "calendar") {
                          setActiveScreen("calendar");
                        } else if (n.kind === "game") {
                          setActiveScreen("games");
                        } else {
                          setActiveScreen("love");
                        }
                      }}
                      className={`w-full text-left py-3 px-2 rounded-xl hover:bg-rose-50/60 dark:hover:bg-[#1E2548] transition ${
                        !n.isRead ? "bg-rose-50/40 dark:bg-rose-500/10" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-[#141124] dark:text-white truncate">
                          {n.title}
                        </p>
                        <span className="text-[10px] text-[#625673] dark:text-[#A6A0C4] shrink-0">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[#625673] dark:text-[#B8B2D6] line-clamp-2 mt-0.5">
                        {n.body}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Responsive Android Content Canvas */}
      <main className="flex-1 mx-auto w-full max-w-2xl px-3.5 sm:px-5 pt-4 pb-20">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScreen}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {activeScreen === "home" && (
              <HomeDashboard
                user={user}
                partner={partner}
                couple={couple}
                memories={memories}
                upcomingEvent={upcomingEvent}
                unreadMessages={unreadMessages}
                unopenedSurprises={unopenedSurprises}
                onNavigate={setActiveScreen}
                onStartCall={handleStartCall}
                onTriggerBurst={triggerBurst}
                onCoupleUpdated={setCouple}
              />
            )}

            {activeScreen === "chat" && (
              <PrivateChatScreen
                user={user}
                partner={partner}
                couple={couple}
                messages={messages}
                setMessages={setMessages}
                callHistory={callHistory}
                onRefreshCalls={handleRefreshCalls}
                onStartCall={handleStartCall}
                onClearUnread={clearUnread}
              />
            )}

            {activeScreen === "love" && (
              <LoveZoneScreen
                user={user}
                partner={partner}
                couple={couple}
                refreshTick={loveRefreshTick}
                onNavigate={setActiveScreen}
                onTriggerBurst={triggerBurst}
                onSurpriseCountChange={setUnopenedSurprises}
              />
            )}

            {activeScreen === "games" && (
              <CoupleGamesScreen
                user={user}
                partner={partner}
                refreshTick={gamesRefreshTick}
                onNavigate={setActiveScreen}
                onTriggerBurst={triggerBurst}
              />
            )}

            {activeScreen === "memories" && (
              <MemoriesScreen
                user={user}
                partner={partner}
                couple={couple}
                memories={memories}
                setMemories={setMemories}
                onCoupleUpdated={setCouple}
                onNavigate={setActiveScreen}
              />
            )}

            {activeScreen === "calendar" && (
              <SharedCalendarScreen
                couple={couple}
                events={calendarEvents}
                setEvents={setCalendarEvents}
                onNavigate={setActiveScreen}
              />
            )}

            {activeScreen === "profile" && (
              <ProfileSettingsScreen
                user={user}
                partner={partner}
                couple={couple}
                onUserUpdated={setUser}
                onCoupleUpdated={setCouple}
                onToggleTheme={handleToggleTheme}
                onNavigate={setActiveScreen}
                onLogout={handleLogout}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Native-Feeling Android Material Bottom Navigation */}
      <nav
        aria-label="Primary navigation"
        className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#12162E]/95 backdrop-blur-xl border-t border-[#F3DCE6] dark:border-[#242C54]"
      >
        <div className="mx-auto max-w-2xl grid grid-cols-5 h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected =
              activeScreen === item.id ||
              (item.id === "love" && activeScreen === "games");

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className="relative flex flex-col items-center justify-center gap-1 transition active:scale-95"
              >
                <div
                  className={`relative flex items-center justify-center px-4 py-1 rounded-full transition-colors ${
                    isSelected
                      ? "bg-rose-100 dark:bg-rose-500/25 text-[#E84A7F] dark:text-rose-300"
                      : "text-[#625673] dark:text-[#A6A0C4]"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isSelected && item.id === "love" ? "fill-[#E84A7F]" : ""
                    }`}
                  />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 right-1 min-w-[16px] h-4 rounded-full bg-[#E84A7F] text-white text-[10px] font-extrabold flex items-center justify-center px-1 shadow-xs">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[11px] leading-none ${
                    isSelected
                      ? "font-bold text-[#E84A7F] dark:text-rose-300"
                      : "font-medium text-[#625673] dark:text-[#A6A0C4]"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
