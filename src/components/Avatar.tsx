"use client";

import { useState } from "react";

interface AvatarProps {
  src: string | null | undefined;
  name: string;
  role?: "husband" | "wife";
  isOnline?: boolean;
  showStatus?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  xs: "w-7 h-7 text-xs",
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-16 h-16 text-lg",
  xl: "w-24 h-24 text-2xl",
};

const DOT_MAP = {
  xs: "w-2 h-2",
  sm: "w-2.5 h-2.5",
  md: "w-3 h-3",
  lg: "w-3.5 h-3.5",
  xl: "w-4 h-4",
};

export function Avatar({
  src,
  name,
  role = "husband",
  isOnline = false,
  showStatus = false,
  size = "md",
  className = "",
}: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initials = (name || "FU")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const ringGradient =
    role === "wife"
      ? "from-rose-400 via-pink-500 to-fuchsia-600"
      : "from-purple-500 via-fuchsia-600 to-rose-500";

  const validSrc = src && src !== failedSrc ? src : null;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${SIZE_MAP[size]} rounded-full p-[2px] bg-gradient-to-tr ${ringGradient} shadow-sm`}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-rose-100 dark:bg-[#1E2548] flex items-center justify-center">
          {validSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={validSrc}
              alt={name}
              onError={() => setFailedSrc(src || null)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-bold text-rose-700 dark:text-rose-200 select-none">
              {initials}
            </span>
          )}
        </div>
      </div>

      {showStatus && (
        <span
          title={isOnline ? "Online now" : "Offline"}
          className={`absolute bottom-0 right-0 ${DOT_MAP[size]} rounded-full ring-2 ring-white dark:ring-[#161B36] ${
            isOnline ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-500"
          }`}
        />
      )}
    </div>
  );
}
