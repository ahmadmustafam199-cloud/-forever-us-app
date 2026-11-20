"use client";

import { useState, useRef } from "react";
import {
  Camera,
  Moon,
  Sun,
  Bell,
  ShieldCheck,
  Lock,
  Smartphone,
  Download,
  LogOut,
  Check,
  Copy,
  CalendarHeart,
  Heart,
  ExternalLink,
} from "lucide-react";
import { Avatar } from "./Avatar";
import {
  apiFetch,
  apiUploadMedia,
  formatLastSeen,
  getTabSessionToken,
} from "@/lib/api-client";
import type {
  UserProfile,
  CoupleInfo,
  ActiveScreen,
} from "@/lib/types";

interface ProfileSettingsScreenProps {
  user: UserProfile;
  partner: UserProfile | null;
  couple: CoupleInfo;
  onUserUpdated: (user: UserProfile) => void;
  onCoupleUpdated: (couple: CoupleInfo) => void;
  onToggleTheme: () => void;
  onNavigate: (screen: ActiveScreen) => void;
  onLogout: () => void;
}

export function ProfileSettingsScreen({
  user,
  partner,
  couple,
  onUserUpdated,
  onCoupleUpdated,
  onToggleTheme,
  onNavigate,
  onLogout,
}: ProfileSettingsScreenProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio);
  const [coupleName, setCoupleName] = useState(couple.coupleName);
  const [annivDate, setAnnivDate] = useState(couple.anniversaryDate);
  const [startDate, setStartDate] = useState(couple.relationshipStartDate);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [copiedSafety, setCopiedSafety] = useState(false);
  const [pingSent, setPingSent] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    setStatusMessage(null);
    try {
      const uploaded = await apiUploadMedia(file, "avatar");
      const res = await apiFetch<{ user: UserProfile }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ avatarMediaId: uploaded.id }),
      });
      onUserUpdated(res.user);
      setStatusMessage("Profile photo updated privately ❤️");
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Could not upload profile photo."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setStatusMessage(null);
    try {
      const [userRes, coupleRes] = await Promise.all([
        apiFetch<{ user: UserProfile }>("/api/auth/me", {
          method: "PATCH",
          body: JSON.stringify({
            displayName: displayName.trim(),
            bio: bio.trim(),
          }),
        }),
        apiFetch<{ couple: CoupleInfo }>("/api/couple/settings", {
          method: "PATCH",
          body: JSON.stringify({
            coupleName: coupleName.trim(),
            anniversaryDate: annivDate,
            relationshipStartDate: startDate,
          }),
        }),
      ]);
      onUserUpdated(userRes.user);
      onCoupleUpdated(coupleRes.couple);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2400);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleToggleE2ee() {
    try {
      const res = await apiFetch<{ couple: CoupleInfo }>("/api/couple/settings", {
        method: "PATCH",
        body: JSON.stringify({ e2eeEnabled: !couple.e2eeEnabled }),
      });
      onCoupleUpdated(res.couple);
    } catch {
      // ignore
    }
  }

  async function handleToggleNotifications() {
    const next = !user.notificationsEnabled;
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore
      }
    }
    try {
      const res = await apiFetch<{ user: UserProfile }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ notificationsEnabled: next }),
      });
      onUserUpdated(res.user);
    } catch {
      // ignore
    }
  }

  async function handleSendHeartbeatPing() {
    try {
      await apiFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({ action: "ping_partner" }),
      });
      setPingSent(true);
      setTimeout(() => setPingSent(false), 2600);
    } catch {
      // ignore
    }
  }

  function handleDownloadAndroidKit() {
    const token = getTabSessionToken();
    const url = token
      ? `/api/export/android-kit?token=${encodeURIComponent(token)}`
      : "/api/export/android-kit";
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Profile Hero Card */}
      <section className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative">
            <Avatar
              src={user.avatarUrl}
              name={user.displayName}
              role={user.role}
              isOnline={true}
              showStatus
              size="xl"
            />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-forever-gradient text-white flex items-center justify-center shadow-lg active:scale-90 transition"
              title="Change private profile photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center sm:text-left flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/15 text-[#E84A7F] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">
              {user.role === "husband" ? "🤵 Authorized Husband" : "👰 Authorized Wife"}
            </span>
            <h1 className="mt-1.5 text-xl font-bold text-[#141124] dark:text-white">
              {user.displayName}
            </h1>
            <p className="text-xs text-[#625673] dark:text-[#A6A0C4]">{user.email}</p>
            {statusMessage && (
              <p className="mt-1.5 text-xs font-semibold text-[#E84A7F]">
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        {/* Connected Spouse Badge */}
        {partner && (
          <div className="mt-5 pt-4 border-t border-[#F3DCE6] dark:border-[#27305C] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar
                src={partner.avatarUrl}
                name={partner.displayName}
                role={partner.role}
                isOnline={partner.isOnline}
                showStatus
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#141124] dark:text-white truncate">
                  Paired with {partner.displayName}
                </p>
                <p className="text-[11px] text-[#625673] dark:text-[#A6A0C4] truncate">
                  {formatLastSeen(partner.lastSeenAt, partner.isOnline)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendHeartbeatPing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-[#1E2548] hover:bg-rose-100 px-3 py-2 text-xs font-bold text-[#E84A7F] shrink-0 transition"
            >
              <Heart className="w-3.5 h-3.5 fill-[#E84A7F]" />
              {pingSent ? "Ping Sent!" : "Ping Love"}
            </button>
          </div>
        )}
      </section>

      {/* Edit Profile & Couple Milestones */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#141124] dark:text-white">
            Profile & Relationship Milestones
          </h2>
          <button
            type="button"
            onClick={() => onNavigate("calendar")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#E84A7F] hover:underline"
          >
            <CalendarHeart className="w-3.5 h-3.5" />
            Shared Calendar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
              Your Name
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
              Couple Sanctuary Name
            </label>
            <input
              type="text"
              required
              value={coupleName}
              onChange={(e) => setCoupleName(e.target.value)}
              className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
            Love Status / Bio
          </label>
          <input
            type="text"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3.5 py-2.5 text-sm outline-none focus:border-[#E84A7F]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
              Together Since
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2 text-xs outline-none focus:border-[#E84A7F]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1">
              Anniversary Date
            </label>
            <input
              type="date"
              value={annivDate}
              onChange={(e) => setAnnivDate(e.target.value)}
              className="w-full rounded-xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] px-3 py-2 text-xs outline-none focus:border-[#E84A7F]"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-forever-gradient py-3 text-xs font-bold text-white shadow-sm hover:brightness-105 transition"
        >
          {profileSaved ? (
            <>
              <Check className="w-4 h-4" />
              Saved Successfully
            </>
          ) : savingProfile ? (
            "Saving..."
          ) : (
            "Save Profile & Milestones"
          )}
        </button>
      </form>

      {/* Appearance & Push Notifications */}
      <section className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-[#141124] dark:text-white">
          Appearance & Notifications
        </h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center">
              {user.theme === "dark" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-[#141124] dark:text-white">
                App Theme
              </p>
              <p className="text-[11px] text-[#625673] dark:text-[#A6A0C4]">
                {user.theme === "dark"
                  ? "Midnight Navy Sanctuary"
                  : "Romantic Blush Daylight"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-xl bg-rose-50 dark:bg-[#1E2548] px-3.5 py-2 text-xs font-bold text-[#E84A7F] transition"
          >
            Switch to {user.theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#F3DCE6] dark:border-[#27305C]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-[#E84A7F] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#141124] dark:text-white">
                Instant Push Notifications
              </p>
              <p className="text-[11px] text-[#625673] dark:text-[#A6A0C4]">
                Alerts for messages, calls & surprise notes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleNotifications}
            className={`w-12 h-7 rounded-full p-1 transition ${
              user.notificationsEnabled
                ? "bg-[#E84A7F]"
                : "bg-slate-200 dark:bg-[#27305C]"
            }`}
            aria-label="Toggle push notifications"
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                user.notificationsEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Security & End-to-End Encryption Vault */}
      <section className="rounded-3xl bg-white dark:bg-[#161B36] border border-[#F3DCE6] dark:border-[#27305C] p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-[#141124] dark:text-white">
            Security & End-to-End Encryption
          </h2>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#141124] dark:text-white">
                Web Crypto AES-256-GCM E2EE
              </p>
              <p className="text-[11px] text-[#625673] dark:text-[#A6A0C4]">
                Encrypt new chat messages client-side before leaving your device
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleE2ee}
            className={`w-12 h-7 rounded-full p-1 shrink-0 transition ${
              couple.e2eeEnabled
                ? "bg-emerald-500"
                : "bg-slate-200 dark:bg-[#27305C]"
            }`}
            aria-label="Toggle end-to-end encryption"
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                couple.e2eeEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="rounded-2xl bg-[#FFF8FA] dark:bg-[#0D1126] border border-[#F3DCE6] dark:border-[#27305C] p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#625673] dark:text-[#A6A0C4]">
              Verified Couple Safety Number (SHA-256)
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(couple.safetyNumber);
                setCopiedSafety(true);
                setTimeout(() => setCopiedSafety(false), 2000);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E84A7F]"
            >
              {copiedSafety ? (
                <>
                  <Check className="w-3 h-3" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy
                </>
              )}
            </button>
          </div>
          <p className="font-mono text-xs tracking-wider text-[#141124] dark:text-rose-100 leading-relaxed">
            {couple.safetyNumber}
          </p>
          <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Strict 2-Account Lock Active · ✓ Short-Lived Signed Private Media URLs
          </p>
        </div>
      </section>

      {/* Android Native & Release Kit Card */}
      <section className="rounded-3xl bg-gradient-to-br from-[#0D1126] to-[#2B174A] text-white p-5 shadow-md space-y-3">
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-5 h-5 text-rose-400" />
          <div>
            <h2 className="text-sm font-bold">Android APK / AAB & Two-Device Sync</h2>
            <p className="text-[11px] text-rose-100/75">
              Install directly on Android or export the Expo + Firebase + EAS release kit
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownloadAndroidKit}
            className="flex items-center justify-center gap-2 rounded-2xl bg-forever-gradient py-3 px-4 text-xs font-bold text-white shadow-md hover:brightness-110 transition"
          >
            <Download className="w-4 h-4" />
            Download Android APK/AAB Kit
          </button>
          <button
            type="button"
            onClick={() => window.open(window.location.origin, "_blank")}
            className="flex items-center justify-center gap-2 rounded-2xl bg-white/12 hover:bg-white/20 border border-white/15 py-3 px-4 text-xs font-bold text-white transition"
          >
            <ExternalLink className="w-4 h-4" />
            Open 2nd Spouse Device Tab
          </button>
        </div>
      </section>

      {/* Secure Logout */}
      <button
        type="button"
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-[#161B36] border border-rose-200 dark:border-rose-500/30 hover:bg-rose-50 dark:hover:bg-rose-500/15 py-3.5 text-sm font-bold text-rose-600 dark:text-rose-400 transition"
      >
        <LogOut className="w-4 h-4" />
        Sign Out Securely
      </button>
    </div>
  );
}
