"use client";

const TAB_TOKEN_KEY = "forever_us_tab_session_token";

export function getTabSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TAB_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTabSessionToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.sessionStorage.setItem(TAB_TOKEN_KEY, token);
    } else {
      window.sessionStorage.removeItem(TAB_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers || {});
  const tabToken = getTabSessionToken();
  if (tabToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${tabToken}`);
  }
  if (
    init.body &&
    typeof init.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string })?.error || `Request failed (${res.status})`
    );
  }
  return data as T;
}

export interface UploadedMediaDTO {
  id: string;
  originalName: string;
  mimeType: string;
  category: string;
  sizeBytes: number;
  durationSec: number | null;
  url: string;
  downloadUrl: string;
}

export async function apiUploadMedia(
  file: File,
  category: "image" | "video" | "audio" | "document" | "avatar",
  durationSec?: number
): Promise<UploadedMediaDTO> {
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);
  if (durationSec !== undefined) {
    form.append("durationSec", String(durationSec));
  }

  const headers = new Headers();
  const tabToken = getTabSessionToken();
  if (tabToken) {
    headers.set("Authorization", `Bearer ${tabToken}`);
  }

  const res = await fetch("/api/media/upload", {
    method: "POST",
    headers,
    body: form,
    credentials: "include",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string })?.error || "Unable to upload media file."
    );
  }
  return (data as { media: UploadedMediaDTO }).media;
}

export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatLastSeen(iso: string, isOnline: boolean, isTyping?: boolean): string {
  if (isTyping) return "typing...";
  if (isOnline) return "Online";
  const d = new Date(iso);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMins < 1) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `Last seen today at ${d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return `Last seen ${d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  })} at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 45) return "Just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function computeRelationshipMetrics(
  relationshipStartDate: string,
  anniversaryDate: string
): {
  daysTogether: number;
  yearsTogether: number;
  nextAnniversaryDays: number;
  nextAnniversaryHours: number;
  nextAnniversaryMins: number;
  anniversaryYearNumber: number;
  formattedAnniversary: string;
} {
  const now = new Date();
  const start = new Date(`${relationshipStartDate}T00:00:00`);
  const diffMs = Math.max(0, now.getTime() - start.getTime());
  const daysTogether = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1);
  const yearsTogether = Math.floor(daysTogether / 365.25);

  const parts = anniversaryDate.split("-").map(Number);
  const origYear = parts[0] || 2022;
  const month = (parts[1] || 6) - 1;
  const day = parts[2] || 18;

  let nextAnniv = new Date(now.getFullYear(), month, day, 0, 0, 0);
  if (nextAnniv.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
    nextAnniv = new Date(now.getFullYear() + 1, month, day, 0, 0, 0);
  }
  // If today is the anniversary
  const untilMs = Math.max(0, nextAnniv.getTime() - now.getTime());
  const nextAnniversaryDays = Math.floor(untilMs / (24 * 60 * 60 * 1000));
  const nextAnniversaryHours = Math.floor(
    (untilMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)
  );
  const nextAnniversaryMins = Math.floor(
    (untilMs % (60 * 60 * 1000)) / (60 * 1000)
  );
  const anniversaryYearNumber = Math.max(1, nextAnniv.getFullYear() - origYear);

  const formattedAnniversary = nextAnniv.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    daysTogether,
    yearsTogether,
    nextAnniversaryDays,
    nextAnniversaryHours,
    nextAnniversaryMins,
    anniversaryYearNumber,
    formattedAnniversary,
  };
}
