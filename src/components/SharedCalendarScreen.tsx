"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
  Bell,
  Trash2,
  X,
  ArrowLeft,
  Heart,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import type {
  CoupleInfo,
  CalendarEventItem,
  ActiveScreen,
} from "@/lib/types";

interface SharedCalendarScreenProps {
  couple: CoupleInfo;
  events: CalendarEventItem[];
  setEvents: React.Dispatch<React.SetStateAction<CalendarEventItem[]>>;
  onNavigate: (screen: ActiveScreen) => void;
}

const CATEGORY_META: Record<
  CalendarEventItem["category"],
  { label: string; emoji: string; badge: string; dot: string }
> = {
  anniversary: {
    label: "Anniversary",
    emoji: "💍",
    badge: "bg-rose-100 dark:bg-rose-500/20 text-[#E84A7F]",
    dot: "bg-[#E84A7F]",
  },
  date_night: {
    label: "Date Night",
    emoji: "🥂",
    badge: "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-200",
    dot: "bg-purple-500",
  },
  travel: {
    label: "Getaway",
    emoji: "✈️",
    badge: "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-200",
    dot: "bg-sky-500",
  },
  birthday: {
    label: "Birthday",
    emoji: "🎂",
    badge: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  milestone: {
    label: "Milestone",
    emoji: "🌹",
    badge: "bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-200",
    dot: "bg-pink-500",
  },
};

export function SharedCalendarScreen({
  couple,
  events,
  setEvents,
  onNavigate,
}: SharedCalendarScreenProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [viewMonth, setViewMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Add event form
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(todayIso);
  const [eventTime, setEventTime] = useState("19:30");
  const [category, setCategory] =
    useState<CalendarEventItem["category"]>("date_night");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [reminder, setReminder] = useState(true);
  const [saving, setSaving] = useState(false);

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ iso: string | null; day: number | null }> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ iso: null, day: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;
      cells.push({ iso, day: d });
    }
    return cells;
  }, [viewMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const ev of events) {
      const list = map.get(ev.eventDate) ?? [];
      list.push(ev);
      map.set(ev.eventDate, list);
    }
    return map;
  }, [events]);

  const annivMonthDay = couple.anniversaryDate.slice(5);

  const displayedEvents = selectedDate
    ? events.filter((e) => e.eventDate === selectedDate)
    : events;

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ event: CalendarEventItem }>("/api/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          eventDate,
          eventTime,
          category,
          location: location.trim(),
          notes: notes.trim(),
          reminder,
        }),
      });
      setEvents((prev) =>
        [...prev, res.event].sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      );
      setTitle("");
      setLocation("");
      setNotes("");
      setShowAdd(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/calendar/${id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="p-2 rounded-xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] text-[#625673] dark:text-[#A6A0C4] hover:text-[#E84A7F]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#141124] dark:text-white">
              Shared Couple Calendar
            </h1>
            <p className="text-xs text-[#625673] dark:text-[#A6A0C4]">
              Date nights, trips & anniversary reminders
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEventDate(selectedDate || todayIso);
            setShowAdd(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-forever-gradient px-4 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          Add Date
        </button>
      </div>

      {/* Interactive Month Grid */}
      <div className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)
              )
            }
            className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-[#1E2548]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-serif text-lg font-bold text-[#141124] dark:text-white">
            {viewMonth.toLocaleDateString([], { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
              )
            }
            className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-[#1E2548]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-[#625673] dark:text-[#A6A0C4] mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((cell, idx) => {
            if (!cell.iso || !cell.day) {
              return <div key={`empty-${idx}`} className="h-11" />;
            }
            const dayEvents = eventsByDate.get(cell.iso) ?? [];
            const isToday = cell.iso === todayIso;
            const isSelected = cell.iso === selectedDate;
            const isAnniv = cell.iso.slice(5) === annivMonthDay;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() =>
                  setSelectedDate(isSelected ? null : cell.iso)
                }
                className={`relative h-11 rounded-2xl flex flex-col items-center justify-center text-xs font-semibold transition ${
                  isSelected
                    ? "bg-forever-gradient text-white shadow-md"
                    : isToday
                    ? "bg-rose-50 dark:bg-rose-500/20 text-[#E84A7F] font-extrabold ring-1 ring-[#E84A7F]/40"
                    : "hover:bg-rose-50/70 dark:hover:bg-[#1E2548] text-[#141124] dark:text-white"
                }`}
              >
                <span>{cell.day}</span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {isAnniv && (
                    <Heart
                      className={`w-2.5 h-2.5 ${
                        isSelected
                          ? "fill-white text-white"
                          : "fill-[#E84A7F] text-[#E84A7F]"
                      }`}
                    />
                  )}
                  {dayEvents.slice(0, 2).map((ev) => (
                    <span
                      key={ev.id}
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-white" : CATEGORY_META[ev.category].dot
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold text-[#141124] dark:text-white">
            {selectedDate ? `Plans on ${selectedDate}` : "All Shared Dates"}
          </h3>
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="text-xs font-semibold text-[#E84A7F] hover:underline"
            >
              Show All Dates
            </button>
          )}
        </div>

        {displayedEvents.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] py-8 text-center text-xs text-[#625673] dark:text-[#A6A0C4]">
            No shared events on this date yet — tap &ldquo;Add Date&rdquo; to plan something romantic ❤️
          </div>
        ) : (
          displayedEvents.map((ev) => {
            const meta = CATEGORY_META[ev.category] || CATEGORY_META.date_night;
            return (
              <div
                key={ev.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-4 shadow-2xs"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${meta.badge}`}
                    >
                      {meta.emoji} {meta.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#625673] dark:text-[#A6A0C4]">
                      <Clock className="w-3 h-3 text-[#E84A7F]" />
                      {ev.eventDate} · {ev.eventTime}
                    </span>
                    {ev.reminder && (
                      <Bell className="w-3 h-3 text-amber-500" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#141124] dark:text-white">
                    {ev.title}
                  </p>
                  {ev.location && (
                    <p className="inline-flex items-center gap-1 text-xs text-[#625673] dark:text-[#A6A0C4]">
                      <MapPin className="w-3 h-3 text-[#E84A7F]" />
                      {ev.location}
                    </p>
                  )}
                  {ev.notes && (
                    <p className="text-xs text-[#625673] dark:text-[#B8B2D6] leading-relaxed">
                      {ev.notes}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(ev.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-[#1E2548] shrink-0"
                  title="Delete date"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Shared Date Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAdd(false)}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.form
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleAddEvent}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-6 shadow-2xl space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#141124] dark:text-white">
                  Plan a Shared Date ❤️
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="p-1 text-slate-400 hover:text-rose-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title (e.g. Anniversary Dinner at La Terrazza)"
                className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
              />

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2.5 text-xs outline-none focus:border-[#E84A7F]"
                />
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2.5 text-xs outline-none focus:border-[#E84A7F]"
                />
              </div>

              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as CalendarEventItem["category"])
                }
                className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-[#E84A7F]"
              >
                <option value="date_night">🥂 Date Night</option>
                <option value="anniversary">💍 Anniversary</option>
                <option value="travel">✈️ Romantic Getaway</option>
                <option value="birthday">🎂 Birthday</option>
                <option value="milestone">🌹 Special Milestone</option>
              </select>

              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (optional)"
                className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-xs outline-none focus:border-[#E84A7F]"
              />

              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Sweet notes or reservation details..."
                className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2 text-xs outline-none focus:border-[#E84A7F] resize-none"
              />

              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminder}
                  onChange={(e) => setReminder(e.target.checked)}
                  className="accent-[#E84A7F] w-4 h-4"
                />
                <span>Notify my spouse & set reminder</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-forever-gradient py-3 text-sm font-bold text-white shadow-md"
              >
                {saving ? "Saving Date..." : "Save to Shared Calendar"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
