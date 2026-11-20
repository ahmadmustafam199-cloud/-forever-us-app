"use client";

import { motion } from "framer-motion";

interface AnimatedHeartLogoProps {
  size?: "sm" | "md" | "lg";
}

export function AnimatedHeartLogo({ size = "lg" }: AnimatedHeartLogoProps) {
  const dims =
    size === "sm"
      ? "w-9 h-9"
      : size === "md"
      ? "w-16 h-16"
      : "w-28 h-28";

  const svgSize = size === "sm" ? 20 : size === "md" ? 34 : 58;

  return (
    <div className={`relative inline-flex items-center justify-center ${dims}`}>
      {size !== "sm" && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full bg-rose-500/25 blur-xl"
            animate={{ scale: [1, 1.32, 1.05, 1.24, 1], opacity: [0.45, 0.8, 0.5, 0.72, 0.45] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-1 rounded-full border border-rose-400/35"
            animate={{ scale: [0.95, 1.38], opacity: [0.65, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
          />
        </>
      )}

      <motion.div
        className="relative flex items-center justify-center w-full h-full rounded-[30%] bg-gradient-to-br from-[#FF5C93] via-[#D63374] to-[#4F1D75] shadow-xl shadow-rose-600/30 border border-white/25"
        animate={
          size === "sm"
            ? { scale: [1, 1.06, 1] }
            : { scale: [1, 1.12, 0.98, 1.08, 1] }
        }
        transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="heartGloss" x1="12" y1="10" x2="52" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#FFE3EE" />
              <stop offset="100%" stopColor="#FFC2DA" />
            </linearGradient>
          </defs>
          <path
            d="M32 55.2C31.1 55.2 30.2 54.9 29.5 54.3C22.4 48.2 8 36.2 8 22.8C8 14.5 14.4 8.2 22.4 8.2C26.7 8.2 30.2 10.2 32 13.1C33.8 10.2 37.3 8.2 41.6 8.2C49.6 8.2 56 14.5 56 22.8C56 36.2 41.6 48.2 34.5 54.3C33.8 54.9 32.9 55.2 32 55.2Z"
            fill="url(#heartGloss)"
          />
          <path
            d="M21 15.5C17.2 15.5 14.5 18.4 14.5 22.2"
            stroke="#FF5C93"
            strokeOpacity="0.45"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </motion.div>
    </div>
  );
}
