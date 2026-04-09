import { sha256Hex } from "./clientAuth";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 2;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function randomBytes(length = 20) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase32(bytes = new Uint8Array()) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32ToBytes(secret = "") {
  const clean = String(secret || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function normalizeNumericCode(code = "") {
  return String(code || "").replace(/\D/g, "");
}

async function hmacSha1(secretBytes, counterBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, counterBytes);
  return new Uint8Array(signature);
}

function buildCounterBytes(counter) {
  const bytes = new Uint8Array(8);
  let value = BigInt(counter);
  for (let idx = 7; idx >= 0; idx -= 1) {
    bytes[idx] = Number(value & 255n);
    value >>= 8n;
  }
  return bytes;
}

async function generateCodeAt(secret = "", timestampMs = Date.now()) {
  const secretBytes = base32ToBytes(secret);
  if (!secretBytes.length) return "";
  const counter = Math.floor(timestampMs / 1000 / TOTP_STEP_SECONDS);
  const digest = await hmacSha1(secretBytes, buildCounterBytes(counter));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  );
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

export function requiresLocalTwoFactor(user = null) {
  return ["superadmin", "admin"].includes(user?.role || "");
}

export function createTwoFactorSecret() {
  return bytesToBase32(randomBytes(20));
}

export function formatTwoFactorSecret(secret = "") {
  return String(secret || "").replace(/(.{4})/g, "$1 ").trim();
}

export function createOtpAuthUrl({ user = {}, issuer = "Produ", secret = "" }) {
  const label = encodeURIComponent(`${issuer}:${user?.email || user?.name || "usuario"}`);
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

export async function verifyTotpCode(secret = "", code = "") {
  const normalized = normalizeNumericCode(code);
  if (normalized.length !== TOTP_DIGITS) return false;
  const now = Date.now();
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const candidate = await generateCodeAt(secret, now + offset * TOTP_STEP_SECONDS * 1000);
    if (candidate === normalized) return true;
  }
  return false;
}

function randomRecoveryChunk(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(length), byte => chars[byte % chars.length]).join("");
}

export function createRecoveryCodes(count = 6) {
  return Array.from({ length: count }, () => `${randomRecoveryChunk(4)}-${randomRecoveryChunk(4)}`);
}

function normalizeRecoveryCode(code = "") {
  return String(code || "").trim().toUpperCase().replace(/\s+/g, "");
}

export async function hashRecoveryCodes(codes = []) {
  return Promise.all((Array.isArray(codes) ? codes : []).map(code => sha256Hex(normalizeRecoveryCode(code))));
}

export async function consumeRecoveryCode(recoveryHashes = [], code = "") {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return { matched: false, remaining: recoveryHashes };
  const hash = await sha256Hex(normalized);
  const idx = (Array.isArray(recoveryHashes) ? recoveryHashes : []).findIndex(item => item === hash);
  if (idx < 0) return { matched: false, remaining: recoveryHashes };
  return {
    matched: true,
    remaining: recoveryHashes.filter((_, current) => current !== idx),
  };
}

export function createPendingTwoFactorState(user = {}, mode = "verify", secret = "") {
  return {
    userId: user?.id || "",
    email: user?.email || "",
    role: user?.role || "",
    mode,
    secret,
    createdAt: Date.now(),
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    attemptsLeft: MAX_ATTEMPTS,
  };
}

export function challengeExpired(challenge = null) {
  return !challenge?.expiresAt || Date.now() > challenge.expiresAt;
}

export function consumeChallengeAttempt(challenge = null) {
  if (!challenge) return null;
  return {
    ...challenge,
    attemptsLeft: Math.max(0, Number(challenge.attemptsLeft || MAX_ATTEMPTS) - 1),
  };
}

export function buildSecondFactorSessionMeta() {
  return {
    authStrength: "mfa_totp",
    requiresSecondFactor: false,
    mfaVerifiedAt: new Date().toISOString(),
  };
}
