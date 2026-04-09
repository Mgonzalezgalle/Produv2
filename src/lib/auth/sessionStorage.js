import { requiresLocalTwoFactor } from "./localTwoFactor";

const SESSION_MAX_AGE_DEFAULT_MS = 12 * 60 * 60 * 1000;
const SESSION_IDLE_DEFAULT_MS = 60 * 60 * 1000;
const SESSION_MAX_AGE_PRIVILEGED_MS = 8 * 60 * 60 * 1000;
const SESSION_IDLE_PRIVILEGED_MS = 15 * 60 * 1000;

export function getSessionPolicy(role = "") {
  if (["superadmin", "admin"].includes(role || "")) {
    return {
      maxAgeMs: SESSION_MAX_AGE_PRIVILEGED_MS,
      idleTimeoutMs: SESSION_IDLE_PRIVILEGED_MS,
    };
  }
  return {
    maxAgeMs: SESSION_MAX_AGE_DEFAULT_MS,
    idleTimeoutMs: SESSION_IDLE_DEFAULT_MS,
  };
}

export function sessionPayload(user, emp, options = {}) {
  const required = requiresLocalTwoFactor(user);
  const now = Date.now();
  const policy = getSessionPolicy(user?.role || "");
  const createdAt = Number(options.createdAt || now);
  const lastActivityAt = Number(options.lastActivityAt || now);
  const maxAgeMs = Number(options.maxAgeMs || policy.maxAgeMs);
  const idleTimeoutMs = Number(options.idleTimeoutMs || policy.idleTimeoutMs);
  const authStrength = options.authStrength || (required ? "password_only" : "password_only");
  const requiresSecondFactor = typeof options.requiresSecondFactor === "boolean"
    ? options.requiresSecondFactor
    : required && authStrength !== "mfa_totp";
  return JSON.stringify({
    userId: user?.id || "",
    empId: emp?.id || null,
    role: user?.role || "",
    authStrength,
    requiresSecondFactor,
    mfaVerifiedAt: options.mfaVerifiedAt || null,
    createdAt,
    lastActivityAt,
    maxAgeMs,
    idleTimeoutMs,
    expiresAt: createdAt + maxAgeMs,
  });
}

export function isStoredSessionExpired(session = null, now = Date.now()) {
  if (!session?.userId) return true;
  const createdAt = Number(session.createdAt || 0);
  const lastActivityAt = Number(session.lastActivityAt || createdAt || 0);
  const maxAgeMs = Number(session.maxAgeMs || 0);
  const idleTimeoutMs = Number(session.idleTimeoutMs || 0);
  if (!createdAt || !lastActivityAt || !maxAgeMs || !idleTimeoutMs) return true;
  if (createdAt + maxAgeMs <= now) return true;
  if (lastActivityAt + idleTimeoutMs <= now) return true;
  return false;
}

function getSessionStore() {
  try {
    if (typeof sessionStorage !== "undefined") return sessionStorage;
  } catch {}
  return null;
}

function getLegacyStore() {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {}
  return null;
}

export function loadStoredJson(storageKey) {
  try {
    const primary = getSessionStore();
    const legacy = getLegacyStore();
    const sessionRaw = primary?.getItem(storageKey);
    if (sessionRaw) return JSON.parse(sessionRaw);
    const legacyRaw = legacy?.getItem(storageKey);
    if (!legacyRaw) return null;
    if (primary) {
      primary.setItem(storageKey, legacyRaw);
      legacy?.removeItem(storageKey);
    }
    return JSON.parse(legacyRaw);
  } catch {
    return null;
  }
}

export function saveStoredJson(storageKey, value) {
  try {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    const primary = getSessionStore();
    const legacy = getLegacyStore();
    primary?.setItem(storageKey, raw);
    legacy?.removeItem(storageKey);
  } catch {}
}

export function touchStoredSession(storageKey, currentSession = null, patch = {}) {
  if (!currentSession?.userId) return null;
  const next = {
    ...currentSession,
    ...patch,
    lastActivityAt: Number(patch.lastActivityAt || Date.now()),
  };
  saveStoredJson(storageKey, next);
  return next;
}

export function removeStoredJson(storageKey) {
  try {
    getSessionStore()?.removeItem(storageKey);
    getLegacyStore()?.removeItem(storageKey);
  } catch {}
}
