"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  HeartHandshake,
  Shield,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { AnimatedHeartLogo } from "./AnimatedHeartLogo";
import { apiFetch } from "@/lib/api-client";
import type { UserProfile, CoupleInfo } from "@/lib/types";

interface ConnectPartnerScreenProps {
  user: UserProfile;
  couple: CoupleInfo | null;
  onCoupleUpdated: (couple: CoupleInfo) => void;
  onConnected: (payload: {
    user: UserProfile;
    couple: CoupleInfo;
    partner: UserProfile | null;
  }) => void;
  onLogout: () => void;
}

export function ConnectPartnerScreen({
  user,
  couple,
  onCoupleUpdated,
  onConnected,
  onLogout,
}: ConnectPartnerScreenProps) {
  const [partnerCode, setPartnerCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const partnerRoleLabel = user.role === "husband" ? "Wife" : "Husband";

  async function handleCopy() {
    if (!couple?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(couple.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const data = await apiFetch<{ couple: CoupleInfo }>("/api/couple/invite", {
        method: "POST",
      });
      onCoupleUpdated(data.couple);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh invite code.");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerCode.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const data = await apiFetch<{
        user: UserProfile;
        couple: CoupleInfo;
        partner: UserProfile | null;
      }>("/api/couple/connect", {
        method: "POST",
        body: JSON.stringify({ inviteCode: partnerCode.trim().toUpperCase() }),
      });
      onConnected(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect accounts.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-midnight-romance text-white flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-1.5 text-xs font-medium">
            <span>{user.role === "husband" ? "🤵" : "👰"}</span>
            <span>{user.displayName}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 px-3.5 py-1.5 text-xs font-medium text-rose-100 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        <div className="text-center pt-1">
          <AnimatedHeartLogo size="md" />
          <h1 className="mt-4 font-serif text-3xl font-bold">
            Connect Your {partnerRoleLabel}
          </h1>
          <p className="mt-1.5 text-sm text-rose-100/80 max-w-sm mx-auto">
            Share your one-time private invitation code with your {partnerRoleLabel.toLowerCase()}, or enter theirs below to seal your private space.
          </p>
        </div>

        {/* Share code card */}
        <div className="rounded-3xl bg-white text-[#141124] p-6 shadow-2xl space-y-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#625673]">
                Your Private Invite Code
              </span>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#E84A7F] hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
                New Code
              </button>
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-[#FFF0F5] border border-[#F3DCE6] px-4 py-3.5">
              <span className="font-mono text-2xl font-extrabold tracking-widest text-[#5B1E6E]">
                {couple?.inviteCode || "LUV-••••••"}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-forever-gradient px-3.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95 transition"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-[#625673] mt-2">
              Waiting automatically — the moment your {partnerRoleLabel.toLowerCase()} enters this code, your screen unlocks instantly.
            </p>
          </div>

          <div className="relative flex items-center py-1">
            <div className="flex-1 border-t border-[#F3DCE6]" />
            <span className="px-3 text-xs font-semibold text-[#625673]">OR ENTER CODE</span>
            <div className="flex-1 border-t border-[#F3DCE6]" />
          </div>

          <form onSubmit={handleConnect} className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#625673]">
              Have Your {partnerRoleLabel}&apos;s Code?
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-rose-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={partnerCode}
                onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                placeholder="LUV-XXXXXX"
                maxLength={16}
                className="w-full rounded-2xl border border-[#F3DCE6] bg-[#FFF9FB] pl-10 pr-4 py-3 font-mono text-base font-bold tracking-widest uppercase outline-none focus:border-[#E84A7F] focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={connecting || partnerCode.trim().length < 5}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-[#0D1126] hover:bg-[#192046] py-3.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-50"
            >
              <HeartHandshake className="w-4 h-4 text-rose-400" />
              <span>{connecting ? "Pairing Hearts..." : "Connect Forever"}</span>
            </button>
          </form>

          <button
            type="button"
            onClick={() => window.open(window.location.origin, "_blank")}
            className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#625673] hover:text-[#E84A7F] pt-1 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open a second window to register your {partnerRoleLabel.toLowerCase()}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-rose-100/75 text-center px-2">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Once paired, the invite code self-destructs so no third person can ever join.</span>
        </div>
      </motion.div>
    </div>
  );
}
