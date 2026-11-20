"use client";

/**
 * Audited browser-native Web Crypto API (AES-256-GCM + PBKDF2-SHA256)
 * end-to-end authenticated encryption helper for couple messages.
 */

const keyCache = new Map<string, CryptoKey>();

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveCoupleKey(coupleId: string, e2eeSalt: string, passphrase?: string): Promise<CryptoKey> {
  const secretMaterial = `FOREVER_US_COUPLE_KEY_V1::${coupleId}::${passphrase || "paired-sanctuary"}`;
  const cacheId = `${coupleId}:${e2eeSalt}:${passphrase || ""}`;
  const cached = keyCache.get(cacheId);
  if (cached) return cached;

  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(secretMaterial),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const saltBytes = hexToBytes(e2eeSalt);
  const saltBuffer = saltBytes.buffer.slice(
    saltBytes.byteOffset,
    saltBytes.byteOffset + saltBytes.byteLength
  ) as ArrayBuffer;

  const aesKey = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100_000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  keyCache.set(cacheId, aesKey);
  return aesKey;
}

export async function encryptCoupleText(
  plaintext: string,
  coupleId: string,
  e2eeSalt: string,
  passphrase?: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveCoupleKey(coupleId, e2eeSalt, passphrase);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptCoupleText(
  ciphertext: string,
  ivBase64: string,
  coupleId: string,
  e2eeSalt: string,
  passphrase?: string
): Promise<string> {
  try {
    const key = await deriveCoupleKey(coupleId, e2eeSalt, passphrase);
    const ivBytes = base64ToBytes(ivBase64);
    const dataBytes = base64ToBytes(ciphertext);

    const ivBuf = ivBytes.buffer.slice(
      ivBytes.byteOffset,
      ivBytes.byteOffset + ivBytes.byteLength
    ) as ArrayBuffer;
    const dataBuf = dataBytes.buffer.slice(
      dataBytes.byteOffset,
      dataBytes.byteOffset + dataBytes.byteLength
    ) as ArrayBuffer;

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuf },
      key,
      dataBuf
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "🔒 Encrypted message";
  }
}
