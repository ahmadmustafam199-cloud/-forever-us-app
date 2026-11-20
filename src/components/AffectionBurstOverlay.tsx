"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { AffectionBurst } from "@/lib/types";

interface AffectionBurstOverlayProps {
  burst: AffectionBurst | null;
  onDismiss: () => void;
}

const PARTICLE_OFFSETS = [
  { x: 8, delay: 0, scale: 1.1, drift: -24 },
  { x: 16, delay: 0.12, scale: 1.4, drift: 18 },
  { x: 24, delay: 0.06, scale: 0.95, drift: -15 },
  { x: 33, delay: 0.2, scale: 1.35, drift: 26 },
  { x: 42, delay: 0.04, scale: 1.5, drift: -20 },
  { x: 50, delay: 0.16, scale: 1.25, drift: 12 },
  { x: 58, delay: 0.08, scale: 1.45, drift: -28 },
  { x: 67, delay: 0.22, scale: 1.1, drift: 20 },
  { x: 75, delay: 0.1, scale: 1.35, drift: -14 },
  { x: 84, delay: 0.18, scale: 1.2, drift: 22 },
  { x: 91, delay: 0.05, scale: 1.0, drift: -18 },
  { x: 47, delay: 0.28, scale: 1.6, drift: 8 },
  { x: 29, delay: 0.32, scale: 1.2, drift: -12 },
  { x: 71, delay: 0.3, scale: 1.3, drift: 16 },
];

export function AffectionBurstOverlay({
  burst,
  onDismiss,
}: AffectionBurstOverlayProps) {
  return (
    <AnimatePresence>
      {burst && (
        <div className="fixed inset-0 z-[90] pointer-events-none overflow-hidden">
          {/* Floating animated emojis & hearts */}
          {PARTICLE_OFFSETS.map((p, idx) => (
            <motion.div
              key={`${burst.id}-${idx}`}
              initial={{
                opacity: 0,
                y: "95vh",
                x: 0,
                scale: 0.4,
                rotate: -12,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: "-12vh",
                x: p.drift,
                scale: p.scale,
                rotate: idx % 2 === 0 ? 16 : -16,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2.8,
                delay: p.delay,
                ease: "easeOut",
              }}
              style={{ left: `${p.x}%` }}
              className="absolute top-0 text-3xl sm:text-4xl drop-shadow-lg select-none"
            >
              {idx % 3 === 1 ? "❤️" : burst.emoji}
            </motion.div>
          ))}

          {/* Floating notification card */}
          <motion.div
            initial={{ opacity: 0, y: -32, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            className="pointer-events-auto mx-auto mt-5 max-w-sm px-4"
          >
            <div className="relative rounded-2xl bg-gradient-to-r from-[#E84A7F] via-[#9D296E] to-[#4A1968] p-[1.5px] shadow-2xl shadow-rose-600/30">
              <div className="flex items-center gap-3.5 rounded-[15px] bg-white/95 dark:bg-[#161B36]/95 backdrop-blur-xl px-4 py-3.5">
                <span className="text-3xl shrink-0">{burst.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#141124] dark:text-white truncate">
                    {burst.senderName ? `${burst.senderName} · ` : ""}
                    {burst.title}
                  </p>
                  <p className="text-xs text-[#625673] dark:text-[#B8B2D6] line-clamp-2 mt-0.5">
                    {burst.note}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="p-1 rounded-full text-slate-400 hover:text-rose-500 transition"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
