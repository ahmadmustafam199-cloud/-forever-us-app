"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";
import { AnimatedHeartLogo } from "./AnimatedHeartLogo";

interface SplashScreenProps {
  onContinue: () => void;
}

export function SplashScreen({ onContinue }: SplashScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.03 }}
      transition={{ duration: 0.45, ease: "easeInOut" }}
      onClick={onContinue}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-midnight-romance text-white px-6 py-12 cursor-pointer select-none overflow-hidden"
    >
      {/* Top subtle badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-md px-4 py-1.5 text-xs font-medium tracking-wide text-rose-100"
      >
        <Sparkles className="w-3.5 h-3.5 text-rose-300" />
        Private Husband & Wife Sanctuary
      </motion.div>

      {/* Center brand emblem */}
      <div className="flex flex-col items-center text-center">
        <AnimatedHeartLogo size="lg" />

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-8 font-serif text-4xl sm:text-5xl font-bold tracking-tight text-white"
        >
          FOREVER US <span className="text-rose-400">❤️</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mt-3 text-base sm:text-lg text-rose-100/85 font-medium tracking-wide"
        >
          Two Hearts, One Private World.
        </motion.p>

        <motion.button
          type="button"
          onClick={onContinue}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-9 rounded-full bg-gradient-to-r from-[#E84A7F] to-[#7C2D96] px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 hover:brightness-110 active:scale-95 transition"
        >
          Enter Sanctuary
        </motion.button>
      </div>

      {/* Bottom encryption footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="flex items-center gap-2 text-xs text-rose-200/70"
      >
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>End-to-End Protected · Exclusively 2 Authorized Accounts</span>
      </motion.div>
    </motion.div>
  );
}
