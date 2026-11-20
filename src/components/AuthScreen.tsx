"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Heart,
  ShieldCheck,
  ArrowRight,
  Smartphone,
} from "lucide-react";
import { AnimatedHeartLogo } from "./AnimatedHeartLogo";
import { apiFetch, setTabSessionToken } from "@/lib/api-client";
import type { UserProfile, CoupleInfo } from "@/lib/types";

interface AuthScreenProps {
  onAuthenticated: (payload: {
    user: UserProfile;
    couple: CoupleInfo | null;
    partner: UserProfile | null;
  }) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"husband" | "wife">("husband");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<"husband" | "wife" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        mode === "login"
          ? { email, password, deviceLabel: navigator.userAgent.slice(0, 80) }
          : {
              displayName,
              email,
              password,
              role,
              deviceLabel: navigator.userAgent.slice(0, 80),
            };

      const data = await apiFetch<{
        user: UserProfile;
        couple: CoupleInfo | null;
        partner: UserProfile | null;
        sessionToken: string;
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      setTabSessionToken(data.sessionToken);
      onAuthenticated({
        user: data.user,
        couple: data.couple,
        partner: data.partner,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function quickSignIn(target: "husband" | "wife") {
    setError(null);
    setDemoLoading(target);
    try {
      const data = await apiFetch<{
        user: UserProfile;
        couple: CoupleInfo | null;
        partner: UserProfile | null;
        sessionToken: string;
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email:
            target === "husband"
              ? "husband@foreverus.love"
              : "wife@foreverus.love",
          password: "ForeverUs2026!",
          deviceLabel: `Android (${target === "husband" ? "Husband" : "Wife"})`,
        }),
      });
      setTabSessionToken(data.sessionToken);
      onAuthenticated({
        user: data.user,
        couple: data.couple,
        partner: data.partner,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <div className="min-h-dvh w-full bg-midnight-romance flex flex-col items-center justify-center px-4 py-8 text-white">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md"
      >
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <AnimatedHeartLogo size="md" />
          <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-white">
            FOREVER US <span className="text-rose-400">❤️</span>
          </h1>
          <p className="mt-1 text-sm text-rose-100/80">
            Two Hearts, One Private World.
          </p>
        </div>

        {/* Main glass auth card */}
        <div className="rounded-3xl bg-white dark:bg-[#161B36] text-[#141124] dark:text-white shadow-2xl shadow-black/40 border border-white/15 p-6 sm:p-7">
          {/* Mode segmented tabs */}
          <div className="grid grid-cols-2 rounded-2xl bg-[#FFF0F5] dark:bg-[#0D1126] p-1 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-2.5 text-sm font-semibold rounded-xl transition ${
                mode === "login"
                  ? "bg-forever-gradient text-white shadow-md"
                  : "text-[#625673] dark:text-[#A6A0C4] hover:text-rose-600"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-2.5 text-sm font-semibold rounded-xl transition ${
                mode === "register"
                  ? "bg-forever-gradient text-white shadow-md"
                  : "text-[#625673] dark:text-[#A6A0C4] hover:text-rose-600"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#625673] dark:text-[#A6A0C4] mb-2">
                    I Am The
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["husband", "wife"] as const).map((r) => {
                      const active = role === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`flex items-center justify-center gap-2 rounded-2xl border-2 py-3 px-3 text-sm font-semibold transition ${
                            active
                              ? "border-[#E84A7F] bg-rose-50 dark:bg-rose-500/15 text-[#E84A7F] dark:text-rose-300"
                              : "border-[#F3DCE6] dark:border-[#27305C] text-[#625673] dark:text-[#A6A0C4]"
                          }`}
                        >
                          <span>{r === "husband" ? "🤵" : "👰"}</span>
                          <span className="capitalize">{r}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-rose-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={role === "husband" ? "e.g. Daniel Carter" : "e.g. Sophia Carter"}
                      className="w-full rounded-2xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#E84A7F] focus:ring-2 focus:ring-rose-500/20 transition"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1.5">
                Private Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-rose-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@foreverus.love"
                  className="w-full rounded-2xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] pl-10 pr-4 py-3 text-sm outline-none focus:border-[#E84A7F] focus:ring-2 focus:ring-rose-500/20 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-rose-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={mode === "register" ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
                  className="w-full rounded-2xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF9FB] dark:bg-[#0D1126] pl-10 pr-11 py-3 text-sm outline-none focus:border-[#E84A7F] focus:ring-2 focus:ring-rose-500/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || demoLoading !== null}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-forever-gradient py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 hover:brightness-105 active:scale-[0.99] disabled:opacity-60 transition"
            >
              {loading ? (
                <span>Securing Sanctuary...</span>
              ) : mode === "login" ? (
                <>
                  <span>Unlock Private Space</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 fill-white" />
                  <span>Create {role === "husband" ? "Husband" : "Wife"} Account</span>
                </>
              )}
            </button>
          </form>

          {/* Paired Two-Device Instant Access */}
          <div className="mt-6 pt-5 border-t border-[#F3DCE6] dark:border-[#27305C]">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#625673] dark:text-[#A6A0C4] mb-3">
              <Smartphone className="w-3.5 h-3.5 text-[#E84A7F]" />
              <span>Paired Couple Live Access (Test on 2 Devices or Tabs)</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={demoLoading !== null || loading}
                onClick={() => quickSignIn("husband")}
                className="flex flex-col items-center rounded-2xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF8FA] dark:bg-[#1E2548] hover:border-[#E84A7F] px-3 py-2.5 transition active:scale-95 disabled:opacity-60"
              >
                <span className="text-xs font-bold text-[#141124] dark:text-white">
                  {demoLoading === "husband" ? "Signing in..." : "Daniel · Husband"}
                </span>
                <span className="text-[11px] text-[#625673] dark:text-[#A6A0C4] mt-0.5">
                  Device 1 Login
                </span>
              </button>
              <button
                type="button"
                disabled={demoLoading !== null || loading}
                onClick={() => quickSignIn("wife")}
                className="flex flex-col items-center rounded-2xl border border-[#F3DCE6] dark:border-[#27305C] bg-[#FFF8FA] dark:bg-[#1E2548] hover:border-[#E84A7F] px-3 py-2.5 transition active:scale-95 disabled:opacity-60"
              >
                <span className="text-xs font-bold text-[#141124] dark:text-white">
                  {demoLoading === "wife" ? "Signing in..." : "Sophia · Wife"}
                </span>
                <span className="text-[11px] text-[#625673] dark:text-[#A6A0C4] mt-0.5">
                  Device 2 Login
                </span>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-rose-100/70 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Strictly limited to 2 verified spouses per invitation code</span>
        </p>
      </motion.div>
    </div>
  );
}
