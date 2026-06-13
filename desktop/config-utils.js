import crypto from "crypto";

// Shadowed by Electron's safeStorage when available — this is the pure-Node fallback.
// When running inside Electron with encryption available, safeStorage takes priority.
// When running in plain Node (e.g. tests), this path is used.

export const DEFAULTS = Object.freeze({
  seekBaseUrl: "https://www.seek.com.au",
  email: "",
  password: "",
  resumePath: "",
  coverLetterPath: "",
  coverLetterText: "",
  resumeSummary: [],
  coverLetter: {
    tone: "professional",
    wordLimit: 280,
    maxWordLimit: 500,
  },
  keywords: "",
  location: "",
  maxApplications: 10,
  reviewBeforeApply: true,
  slowMoMs: 0,
  browserProfileDir: ".playwright-seek-profile",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  contactWebsite: "",
  ai: {
    mode: "hosted",
    hostedModel: "budget",
    byokProvider: "openrouter",
    byokModel: "deepseek/deepseek-chat",
    apiKey: "",
  },
});

/**
 * Merge config layers: DEFAULTS → existing (file) → incoming (UI).
 * The spread ensures the last layer wins for each key.
 */
export function mergeConfig(existing = {}, incoming = {}) {
  return { ...DEFAULTS, ...existing, ...incoming };
}

/**
 * Encrypt a plaintext string.
 * If `safeStorage` is available (Electron), it's called externally before this path.
 * This is the AES-256-GCM fallback usable in plain Node.js.
 */
export function encryptKey(plaintext) {
  const key = crypto.scryptSync("seek-buddy-fallback-key-v1", "salt", 32);
  const iv = Buffer.alloc(16, 0);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([tag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64-encoded payload produced by encryptKey.
 * Returns null if decryption fails (corrupted or tampered data).
 */
export function decryptKey(encoded) {
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < 16) return null; // need at least a 16-byte auth tag

  try {
    const tag = buf.subarray(0, 16);
    const data = buf.subarray(16);
    const key = crypto.scryptSync("seek-buddy-fallback-key-v1", "salt", 32);
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data, undefined, "utf8") + decipher.final("utf8");
  } catch {
    return null;
  }
}
