export const TRANSACTIONAL_EMAIL_MODES = {
  DISABLED: "disabled",
  MOCK: "mock",
  RESEND: "resend",
};

function normalizeMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === TRANSACTIONAL_EMAIL_MODES.MOCK) return TRANSACTIONAL_EMAIL_MODES.MOCK;
  if (safe === TRANSACTIONAL_EMAIL_MODES.RESEND) return TRANSACTIONAL_EMAIL_MODES.RESEND;
  return TRANSACTIONAL_EMAIL_MODES.DISABLED;
}

function readEnv(key, fallback = "") {
  try {
    return String(import.meta.env?.[key] || fallback).trim();
  } catch {
    return String(fallback || "").trim();
  }
}

export function getTransactionalEmailConfig() {
  const mode = normalizeMode(readEnv("VITE_TRANSACTIONAL_EMAIL_MODE", TRANSACTIONAL_EMAIL_MODES.DISABLED));
  const fromEmail = readEnv("VITE_RESEND_FROM_EMAIL");
  const fromName = readEnv("VITE_RESEND_FROM_NAME", "Produ");
  const replyTo = readEnv("VITE_RESEND_REPLY_TO");
  return {
    mode,
    provider: mode === TRANSACTIONAL_EMAIL_MODES.RESEND ? "resend" : (mode === TRANSACTIONAL_EMAIL_MODES.MOCK ? "mock" : "disabled"),
    fromEmail,
    fromName,
    replyTo,
    enabled: mode !== TRANSACTIONAL_EMAIL_MODES.DISABLED,
    isMock: mode === TRANSACTIONAL_EMAIL_MODES.MOCK,
    isResend: mode === TRANSACTIONAL_EMAIL_MODES.RESEND,
    ready: mode === TRANSACTIONAL_EMAIL_MODES.MOCK || (mode === TRANSACTIONAL_EMAIL_MODES.RESEND && !!fromEmail),
  };
}

export function getTransactionalEmailProviderSnapshot() {
  const config = getTransactionalEmailConfig();
  return {
    mode: config.mode,
    provider: config.provider,
    enabled: config.enabled,
    ready: config.ready,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    replyTo: config.replyTo,
    tokenConfigured: config.mode === TRANSACTIONAL_EMAIL_MODES.RESEND,
  };
}
