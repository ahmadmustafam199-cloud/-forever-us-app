"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Heart,
  Download,
  Trash2,
  X,
  Calendar,
  Film,
  Image as ImageIcon,
  Pencil,
  Check,
  Sparkles,
  CalendarHeart,
} from "lucide-react";
import {
  apiFetch,
  apiUploadMedia,
  computeRelationshipMetrics,
} from "@/lib/api-client";
import type {
  UserProfile,
  CoupleInfo,
  MemoryItem,
  ActiveScreen,
} from "@/lib/types";

interface MemoriesScreenProps {
  user: UserProfile;
  partner: UserProfile | null;
  couple: CoupleInfo;
  memories: MemoryItem[];
  setMemories: React.Dispatch<React.SetStateAction<MemoryItem[]>>;
  onCoupleUpdated: (couple: CoupleInfo) => void;
  onNavigate: (screen: ActiveScreen) => void;
}

export function MemoriesScreen({
  user,
  partner,
  couple,
  memories,
  setMemories,
  onCoupleUpdated,
  onNavigate,
}: MemoriesScreenProps) {
  const [filter, setFilter] = useState<"all" | "photo" | "video" | "favorite">("all");
  const [selectedMemory, setSelectedMemory] = useState<MemoryItem | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showDateEdit, setShowDateEdit] = useState(false);

  // Upload form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [album, setAlbum] = useState("Our Moments");
  const [memoryDate, setMemoryDate] = useState(new Date().toISOString().slice(0, 10));
  const [isFavorite, setIsFavorite] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inline lightbox edit
  const [editingDetail, setEditingDetail] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editDate, setEditDate] = useState("");

  // Anniversary date edit
  const [startInput, setStartInput] = useState(couple.relationshipStartDate);
  const [annivInput, setAnnivInput] = useState(couple.anniversaryDate);
  const [savingDates, setSavingDates] = useState(false);

  const metrics = computeRelationshipMetrics(
    couple.relationshipStartDate,
    couple.anniversaryDate
  );

  const filtered = memories.filter((m) => {
    if (filter === "photo") return m.mediaType === "photo";
    if (filter === "video") return m.mediaType === "video";
    if (filter === "favorite") return m.isFavorite;
    return true;
  });

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    setUploadError(null);
    const objectUrl = URL.createObjectURL(f);
    setUploadPreview(objectUrl);
    if (!title) {
      setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").slice(0, 60));
    }
  }

  async function handleCreateMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !title.trim()) return;
    setUploading(true);
    setUploadError(null);

    try {
      const category = uploadFile.type.startsWith("video/") ? "video" : "image";
      const uploaded = await apiUploadMedia(uploadFile, category);
      const res = await apiFetch<{ memory: MemoryItem }>("/api/memories", {
        method: "POST",
        body: JSON.stringify({
          mediaId: uploaded.id,
          title: title.trim(),
          caption: caption.trim(),
          album: album.trim() || "Our Moments",
          memoryDate,
          isFavorite,
        }),
      });
      setMemories((prev) => [res.memory, ...prev]);
      setShowUpload(false);
      setUploadFile(null);
      setUploadPreview(null);
      setTitle("");
      setCaption("");
      setAlbum("Our Moments");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to save memory.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleFavorite(mem: MemoryItem, e?: React.MouseEvent) {
    e?.stopPropagation();
    const next = !mem.isFavorite;
    setMemories((prev) =>
      prev.map((m) => (m.id === mem.id ? { ...m, isFavorite: next } : m))
    );
    if (selectedMemory?.id === mem.id) {
      setSelectedMemory({ ...mem, isFavorite: next });
    }
    try {
      await apiFetch(`/api/memories/${mem.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isFavorite: next }),
      });
    } catch {
      // revert on error
      setMemories((prev) =>
        prev.map((m) => (m.id === mem.id ? { ...m, isFavorite: !next } : m))
      );
    }
  }

  async function handleSaveMemoryEdit() {
    if (!selectedMemory || !editTitle.trim()) return;
    try {
      await apiFetch(`/api/memories/${selectedMemory.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(),
          caption: editCaption.trim(),
          memoryDate: editDate,
        }),
      });
      const updated = {
        ...selectedMemory,
        title: editTitle.trim(),
        caption: editCaption.trim(),
        memoryDate: editDate,
      };
      setMemories((prev) =>
        prev.map((m) => (m.id === selectedMemory.id ? updated : m))
      );
      setSelectedMemory(updated);
      setEditingDetail(false);
    } catch {
      // ignore
    }
  }

  async function handleDeleteMemory(id: string) {
    try {
      await apiFetch(`/api/memories/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setSelectedMemory(null);
    } catch {
      // ignore
    }
  }

  async function handleSaveMilestoneDates(e: React.FormEvent) {
    e.preventDefault();
    setSavingDates(true);
    try {
      const res = await apiFetch<{ couple: CoupleInfo }>("/api/couple/settings", {
        method: "PATCH",
        body: JSON.stringify({
          relationshipStartDate: startInput,
          anniversaryDate: annivInput,
        }),
      });
      onCoupleUpdated(res.couple);
      setShowDateEdit(false);
    } catch {
      // ignore
    } finally {
      setSavingDates(false);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Relationship Day Counter & Anniversary Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-[#0D1126] via-[#2B174A] to-[#8C2562] p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Our Private Memory Vault
            </p>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold">
              {metrics.daysTogether.toLocaleString()} Days Together
            </h1>
            <p className="text-xs text-rose-100/80 mt-1">
              Next anniversary in{" "}
              <strong className="text-white">
                {metrics.nextAnniversaryDays} days, {metrics.nextAnniversaryHours} hrs
              </strong>{" "}
              ({metrics.formattedAnniversary})
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-[#E84A7F] hover:bg-rose-500 px-4 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              Add Memory
            </button>
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => {
                  setStartInput(couple.relationshipStartDate);
                  setAnnivInput(couple.anniversaryDate);
                  setShowDateEdit((v) => !v);
                }}
                className="rounded-xl bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-[11px] font-semibold text-rose-100 transition"
              >
                Edit Dates
              </button>
              <button
                type="button"
                onClick={() => onNavigate("calendar")}
                className="inline-flex items-center gap-1 rounded-xl bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-[11px] font-semibold text-rose-100 transition"
              >
                <CalendarHeart className="w-3 h-3" />
                Calendar
              </button>
            </div>
          </div>
        </div>

        {showDateEdit && (
          <form
            onSubmit={handleSaveMilestoneDates}
            className="mt-4 pt-4 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          >
            <div>
              <label className="block text-[11px] text-rose-200 font-semibold mb-1">
                Relationship Start Date
              </label>
              <input
                type="date"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] text-rose-200 font-semibold mb-1">
                Wedding / Anniversary Date
              </label>
              <input
                type="date"
                value={annivInput}
                onChange={(e) => setAnnivInput(e.target.value)}
                className="w-full rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={savingDates}
              className="rounded-xl bg-white text-[#5B1E6E] py-2 px-4 text-xs font-bold hover:bg-rose-50 transition"
            >
              {savingDates ? "Saving..." : "Save Milestones"}
            </button>
          </form>
        )}
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            { id: "all", label: `All (${memories.length})` },
            {
              id: "photo",
              label: `Photos (${memories.filter((m) => m.mediaType === "photo").length})`,
            },
            {
              id: "video",
              label: `Video Albums (${
                memories.filter((m) => m.mediaType === "video").length
              })`,
            },
            {
              id: "favorite",
              label: `Favorites ❤️ (${memories.filter((m) => m.isFavorite).length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === tab.id
                ? "bg-forever-gradient text-white shadow-sm"
                : "bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] text-[#625673] dark:text-[#A6A0C4] hover:border-[#E84A7F]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Memories Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] py-14 px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/15 text-[#E84A7F] flex items-center justify-center mx-auto mb-3">
            {filter === "video" ? (
              <Film className="w-6 h-6" />
            ) : (
              <ImageIcon className="w-6 h-6" />
            )}
          </div>
          <p className="text-sm font-bold text-[#141124] dark:text-white">
            No {filter === "all" ? "" : filter} memories yet
          </p>
          <p className="text-xs text-[#625673] dark:text-[#A6A0C4] mt-1 max-w-xs mx-auto">
            Every photo and video you upload is stored strictly inside your encrypted couple sanctuary.
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-forever-gradient px-5 py-2.5 text-xs font-bold text-white shadow-md"
          >
            <Plus className="w-4 h-4" />
            Upload Memory
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((mem) => {
            const byName =
              mem.uploaderId === user.id
                ? "You"
                : partner?.displayName.split(" ")[0] || "Spouse";
            return (
              <motion.div
                key={mem.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  setSelectedMemory(mem);
                  setEditingDetail(false);
                }}
                className="group cursor-pointer rounded-3xl overflow-hidden bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] shadow-xs hover:shadow-md transition"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#FFF0F5] dark:bg-[#1E2548]">
                  {mem.mediaType === "video" ? (
                    <>
                      <video
                        src={mem.url}
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white">
                        <Film className="w-3 h-3" />
                        Video
                      </span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mem.url}
                      alt={mem.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1 text-[11px] font-semibold text-white">
                    {mem.album}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(mem, e)}
                    aria-label="Toggle favorite memory"
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center active:scale-90 transition"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        mem.isFavorite
                          ? "fill-rose-400 text-rose-400"
                          : "text-white"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#141124] dark:text-white truncate">
                      {mem.title}
                    </h3>
                    <span className="text-[11px] text-[#625673] dark:text-[#A6A0C4] shrink-0 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#E84A7F]" />
                      {mem.memoryDate}
                    </span>
                  </div>
                  {mem.caption && (
                    <p className="mt-1.5 text-xs text-[#625673] dark:text-[#A6A0C4] line-clamp-2 leading-relaxed">
                      {mem.caption}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] font-medium text-[#E84A7F]">
                    Added by {byName}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Upload Memory Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUpload(false)}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.form
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleCreateMemory}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#141124] dark:text-white">
                  Save a Private Memory ❤️
                </h2>
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="p-1 text-slate-400 hover:text-rose-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                onChange={onFilePicked}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[16/9] rounded-2xl border-2 border-dashed border-[#F3DCE6] dark:border-[#27305C] hover:border-[#E84A7F] bg-[#FFF8FA] dark:bg-[#0D1126] overflow-hidden flex flex-col items-center justify-center transition"
              >
                {uploadPreview && uploadFile ? (
                  uploadFile.type.startsWith("video/") ? (
                    <video
                      src={uploadPreview}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uploadPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="text-center px-4">
                    <ImageIcon className="w-8 h-8 text-[#E84A7F] mx-auto mb-2" />
                    <p className="text-xs font-bold text-[#141124] dark:text-white">
                      Choose Photo or Video
                    </p>
                    <p className="text-[11px] text-[#625673] dark:text-[#A6A0C4] mt-0.5">
                      JPG, PNG, WEBP, MP4 or WebM · Validated & Private
                    </p>
                  </div>
                )}
              </button>

              <div>
                <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
                  Memory Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sunset Picnic by the Lake"
                  className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
                    Album
                  </label>
                  <input
                    type="text"
                    value={album}
                    onChange={(e) => setAlbum(e.target.value)}
                    placeholder="Our Moments"
                    className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={memoryDate}
                    onChange={(e) => setMemoryDate(e.target.value)}
                    className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
                  Romantic Caption
                </label>
                <textarea
                  rows={2}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write what made this moment unforgettable..."
                  className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F] resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-[#141124] dark:text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(e) => setIsFavorite(e.target.checked)}
                  className="accent-[#E84A7F] w-4 h-4 rounded"
                />
                <span>Mark as Favorite Memory ❤️</span>
              </label>

              {uploadError && (
                <p className="text-xs text-rose-600 font-medium">{uploadError}</p>
              )}

              <button
                type="submit"
                disabled={uploading || !uploadFile}
                className="w-full rounded-2xl bg-forever-gradient py-3 text-sm font-bold text-white shadow-md disabled:opacity-50"
              >
                {uploading ? "Encrypting & Saving..." : "Add to Private Vault"}
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Memory Detail & Download Lightbox */}
      <AnimatePresence>
        {selectedMemory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMemory(null)}
            className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl rounded-3xl overflow-hidden bg-white dark:bg-[#161B36] border border-white/15 shadow-2xl max-h-[90dvh] flex flex-col"
            >
              <div className="relative bg-black max-h-[52dvh] flex items-center justify-center overflow-hidden">
                {selectedMemory.mediaType === "video" ? (
                  <video
                    src={selectedMemory.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[52dvh] w-full object-contain"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedMemory.url}
                    alt={selectedMemory.title}
                    className="max-h-[52dvh] w-full object-contain"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setSelectedMemory(null)}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto">
                {editingDetail ? (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2 text-sm font-bold"
                    />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2 text-xs"
                    />
                    <textarea
                      rows={2}
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2 text-xs resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleSaveMemoryEdit}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-forever-gradient px-4 py-2 text-xs font-bold text-white"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save Changes
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-[#E84A7F]">
                          {selectedMemory.album} · {selectedMemory.memoryDate}
                        </span>
                        <h3 className="text-lg font-bold text-[#141124] dark:text-white">
                          {selectedMemory.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(selectedMemory)}
                        className="p-2 rounded-xl bg-rose-50 dark:bg-[#1E2548]"
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            selectedMemory.isFavorite
                              ? "fill-[#E84A7F] text-[#E84A7F]"
                              : "text-slate-400"
                          }`}
                        />
                      </button>
                    </div>
                    {selectedMemory.caption && (
                      <p className="text-sm text-[#625673] dark:text-[#B8B2D6] leading-relaxed">
                        {selectedMemory.caption}
                      </p>
                    )}
                  </>
                )}

                <div className="pt-3 border-t border-[#F3DCE6] dark:border-[#27305C] flex items-center justify-between gap-2">
                  <a
                    href={selectedMemory.downloadUrl}
                    download={selectedMemory.originalName}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-forever-gradient px-4 py-2 text-xs font-bold text-white shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Memory
                  </a>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditTitle(selectedMemory.title);
                        setEditCaption(selectedMemory.caption);
                        setEditDate(selectedMemory.memoryDate);
                        setEditingDetail((v) => !v);
                      }}
                      className="p-2 rounded-xl bg-rose-50 dark:bg-[#1E2548] text-[#625673] dark:text-[#A6A0C4] hover:text-[#E84A7F]"
                      title="Edit caption & date"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMemory(selectedMemory.id)}
                      className="p-2 rounded-xl bg-rose-50 dark:bg-[#1E2548] text-rose-600 hover:bg-rose-100"
                      title="Delete memory"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
