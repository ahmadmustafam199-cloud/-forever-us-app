# FOREVER US ❤️
**Two Hearts, One Private World.**

Premium private couple messaging, audio & video calling, shared memories, and Love Zone application exclusively for two authorized spouses: **Husband** and **Wife**.

---

## Included Screens & Features
1. **Splash Screen** — Animated heartbeat logo, Midnight Navy & Romantic Rose aura, private sanctuary status.
2. **Login / Register** — Separate **Husband** and **Wife** accounts with bcrypt-hashed passwords, secure `HttpOnly` sessions, and per-window multi-device testing tokens.
3. **Connect Partner** — Cryptographic one-time private invitation code (`LUV-XXXXXX`) that permanently locks each sanctuary to exactly two authorized spouses and self-destructs upon pairing.
4. **Home Dashboard** — Intertwined couple avatars with live online status, **Relationship Day Counter**, **Anniversary Countdown**, one-tap affection triggers, daily romantic quote, unread chat & surprise alerts, and favorite memories strip.
5. **Private Chat (WhatsApp-Style)** — Real-time Server-Sent Events messaging, emojis, 12 custom love stickers, photo & video sharing, live `MediaRecorder` voice notes with waveform player (`1x`/`1.5x`), PDF/document sharing, reply, forward, edit, delete, reactions, read receipts (`✓` / `✓✓`), live typing indicator, online & last seen, chat history search, and optional client-side Web Crypto **AES-256-GCM End-to-End Encryption**.
6. **Audio & Video Calling** — One-to-one WebRTC audio and video calls with incoming call ringtone & notification, accept/decline/end, mic mute, camera toggle, speaker toggle, in-call floating hearts, and persistent call history.
7. **Shared Memories Gallery** — Private photo and video albums, validated upload & download, captions, dates, favorite hearts, relationship day counter, and editable anniversary milestones.
8. **Love Zone ❤️** — Daily romantic notes, virtual roses 🌹, kisses 💋, hugs 🫂, and heart showers 💖 with live animated particle overlays across both devices, wax-sealed surprise love letters, and side-by-side romantic couple questions.
9. **Couple Games** — Interactive **Love Quiz** with live Soulmate Sync %, **Truth or Dare** (Sweet / Romantic / Deep tiers), and **Couple Challenges** with points tracking.
10. **Shared Calendar** — Interactive monthly calendar with automatic yearly anniversary markers, color-coded date nights/trips/milestones, partner notifications, and reminders.
11. **Profile & Settings** — Private profile photo upload, bio & couple name editor, **Light (Romantic Blush)** and **Dark (Midnight Navy)** themes, push notifications + heartbeat ping, SHA-256 Couple Safety Number verification, Android APK/AAB release kit export, and secure logout.

---

## Security & Privacy
- **Strict Two-Account Access Control**: Enforced via database unique constraints (`husband_id`, `wife_id`), server-side couple membership guards, and included `firestore.rules` & `storage.rules`.
- **Zero Public Media URLs**: Uploaded and shared media are stored outside `public/` in private storage, validated against MIME allowlists, size limits, and binary magic-byte signatures, and streamed exclusively via short-lived HMAC-signed or session-authenticated `/api/media/[id]` requests (`401 Unauthorized` for any unauthenticated or cross-couple access).
- **End-to-End Encryption Option**: Standards-based browser Web Crypto API (`PBKDF2-SHA256` + `AES-256-GCM`) toggleable in **Profile → Security & End-to-End Encryption**, paired with a verifiable 60-digit SHA-256 Safety Number.

---

## Two-Device / Two-Window Testing
1. Open the app on **Android Device 1** (or Browser Tab 1) and register a **Husband** account (or tap **Daniel · Husband**).
2. Open the app on **Android Device 2** (or Browser Tab 2) and register a **Wife** account (or tap **Sophia · Wife**).
3. Connect accounts with the generated `LUV-XXXXXX` private invitation code, then test live chat, typing indicators, read receipts, voice notes, virtual roses, and WebRTC audio/video calling in real time.

---

## Android APK & Release AAB Build
- **Install Instantly on Android**: Open the live URL in Android Chrome → tap Menu → **Install App / Add to Home Screen** (powered by `public/manifest.webmanifest`).
- **Native Expo / React Native APK & AAB Release**: Open **Profile → Download Android APK/AAB Kit** (or see `eas.json`, `firestore.rules`, and `storage.rules` in project root) and run:
  ```bash
  eas build --platform android --profile preview-apk      # Installable .apk
  eas build --platform android --profile production-aab   # Play Store release .aab
  ```
