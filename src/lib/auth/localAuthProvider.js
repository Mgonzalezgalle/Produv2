import { isStoredSessionExpired, removeStoredJson, saveStoredJson, sessionPayload, validateStoredSessionBinding } from "./sessionStorage";
import { sha256Hex } from "./authCrypto";
import { findActiveDomainUserByEmail, findActiveDomainUserById, normalizeAuthEmail, resolveTenantForUser } from "./authIdentity";
import { requiresLocalTwoFactor } from "./localTwoFactor";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_CODE_ATTEMPTS = 5;

function remainingLockMinutes(lockedUntil = 0) {
  const remainingMs = Number(lockedUntil || 0) - Date.now();
  return Math.max(1, Math.ceil(remainingMs / 60000));
}

function createResetCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => chars[byte % chars.length]).join("");
}

export async function authenticateLocalUser({ users = [], email = "", password = "" }) {
  const safeEmail = normalizeAuthEmail(email);
  const userByEmail = findActiveDomainUserByEmail(users, safeEmail);
  if (userByEmail?.loginLockedUntil && Number(userByEmail.loginLockedUntil) > Date.now()) {
    return {
      user: null,
      error: `Cuenta bloqueada temporalmente. Intenta nuevamente en ${remainingLockMinutes(userByEmail.loginLockedUntil)} min.`,
      requiresSecondFactor: false,
      updatedUser: null,
    };
  }
  const hashedPass = await sha256Hex(password);
  const valid = !!(userByEmail && (
    userByEmail.passwordHash === hashedPass ||
    (!userByEmail.passwordHash && userByEmail.password === password)
  ));
  if (valid) {
    return {
      user: userByEmail,
      error: "",
      requiresSecondFactor: requiresLocalTwoFactor(userByEmail),
      updatedUser: userByEmail.loginFailures || userByEmail.loginLockedUntil
        ? {
            ...userByEmail,
            loginFailures: 0,
            loginLockedUntil: 0,
            lastFailedLoginAt: "",
            lastSuccessfulLoginAt: new Date().toISOString(),
          }
        : {
            ...userByEmail,
            lastSuccessfulLoginAt: new Date().toISOString(),
          },
    };
  }
  if (!userByEmail) {
    return {
      user: null,
      error: "Email o contraseña incorrectos",
      requiresSecondFactor: false,
      updatedUser: null,
    };
  }
  const nextFailures = Number(userByEmail.loginFailures || 0) + 1;
  const shouldLock = nextFailures >= MAX_LOGIN_ATTEMPTS;
  const lockedUntil = shouldLock ? Date.now() + LOCKOUT_MINUTES * 60 * 1000 : 0;
  return {
    user: null,
    error: shouldLock
      ? `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCKOUT_MINUTES} min.`
      : "Email o contraseña incorrectos",
    requiresSecondFactor: false,
    updatedUser: {
      ...userByEmail,
      loginFailures: nextFailures,
      loginLockedUntil: lockedUntil,
      lastFailedLoginAt: new Date().toISOString(),
    },
  };
}

export function resolveSessionState({ storedSession, users = [], empresas = [], sessionKey }) {
  if (!storedSession || !Array.isArray(users) || !Array.isArray(empresas)) {
    return { user: null, empresa: null, clearSession: false };
  }
  const freshUser = findActiveDomainUserById(users, storedSession.userId);
  if (!freshUser) {
    removeStoredJson(sessionKey);
    return { user: null, empresa: null, clearSession: true };
  }
  if (isStoredSessionExpired(storedSession)) {
    removeStoredJson(sessionKey);
    return { user: null, empresa: null, clearSession: true };
  }
  const sessionBinding = validateStoredSessionBinding(storedSession, freshUser, empresas);
  if (!sessionBinding.ok) {
    removeStoredJson(sessionKey);
    return { user: null, empresa: null, clearSession: true, invalidReason: sessionBinding.reason };
  }
  const freshEmp = resolveTenantForUser(freshUser, empresas, storedSession);
  return { user: freshUser, empresa: freshEmp || null, clearSession: false };
}

export function persistSession({ sessionKey, user, empresa, options }) {
  const payload = sessionPayload(user, empresa || null, options);
  saveStoredJson(sessionKey, payload);
  return JSON.parse(payload);
}

export async function requestLocalPasswordReset({ users = [], email = "" }) {
  const safeEmail = normalizeAuthEmail(email);
  const user = findActiveDomainUserByEmail(users, safeEmail);
  if (!user) {
    return {
      ok: true,
      message: "Si el correo existe, generamos un código temporal de recuperación.",
      revealedCode: "",
      updatedUser: null,
    };
  }
  const code = createResetCode();
  const codeHash = await sha256Hex(code);
  return {
    ok: true,
    message: "Se generó un código temporal de recuperación.",
    revealedCode: code,
    updatedUser: {
      ...user,
      passwordResetHash: codeHash,
      passwordResetRequestedAt: new Date().toISOString(),
      passwordResetExpiresAt: Date.now() + RESET_CODE_TTL_MS,
      passwordResetAttemptsLeft: RESET_CODE_ATTEMPTS,
    },
  };
}

export async function completeLocalPasswordReset({ users = [], email = "", code = "", newPassword = "" }) {
  const safeEmail = normalizeAuthEmail(email);
  const user = findActiveDomainUserByEmail(users, safeEmail);
  if (!user?.passwordResetHash) {
    return {
      ok: false,
      message: "No hay una recuperación activa para este correo.",
      updatedUser: null,
    };
  }
  if (Number(user.passwordResetExpiresAt || 0) <= Date.now()) {
    return {
      ok: false,
      message: "El código expiró. Solicita uno nuevo.",
      updatedUser: {
        ...user,
        passwordResetHash: "",
        passwordResetRequestedAt: "",
        passwordResetExpiresAt: 0,
        passwordResetAttemptsLeft: 0,
      },
    };
  }
  const attemptsLeft = Number(user.passwordResetAttemptsLeft || RESET_CODE_ATTEMPTS);
  const codeHash = await sha256Hex(String(code || "").trim().toUpperCase());
  if (codeHash !== user.passwordResetHash) {
    const nextAttempts = Math.max(0, attemptsLeft - 1);
    return {
      ok: false,
      message: nextAttempts > 0
        ? `Código inválido. Te quedan ${nextAttempts} intentos.`
        : "Demasiados intentos inválidos. Solicita un nuevo código.",
      updatedUser: {
        ...user,
        passwordResetHash: nextAttempts > 0 ? user.passwordResetHash : "",
        passwordResetRequestedAt: nextAttempts > 0 ? user.passwordResetRequestedAt : "",
        passwordResetExpiresAt: nextAttempts > 0 ? user.passwordResetExpiresAt : 0,
        passwordResetAttemptsLeft: nextAttempts,
      },
    };
  }
  const passwordHash = await sha256Hex(newPassword);
  return {
    ok: true,
    message: "Contraseña actualizada correctamente.",
    updatedUser: {
      ...user,
      passwordHash,
      password: "",
      passwordResetHash: "",
      passwordResetRequestedAt: "",
      passwordResetExpiresAt: 0,
      passwordResetAttemptsLeft: 0,
      loginFailures: 0,
      loginLockedUntil: 0,
      lastPasswordResetAt: new Date().toISOString(),
    },
  };
}
