export const GOOGLE_CALENDAR_MODES = {
  DISABLED: "disabled",
  OAUTH: "oauth",
};

export const GOOGLE_CALENDAR_DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
];

const FALLBACK_SUPABASE_URL = "https://zpgxbmlzoxxgymsschrd.supabase.co";
const FALLBACK_GOOGLE_CLIENT_ID = "1028856995887-g3j810n1cb3eeppptge86so48smk3a59.apps.googleusercontent.com";

function readEnv(key, fallback = "") {
  try {
    return String(import.meta.env?.[key] || fallback).trim();
  } catch {
    return String(fallback || "").trim();
  }
}

function readSupabaseUrl() {
  return readEnv("VITE_SUPABASE_URL", FALLBACK_SUPABASE_URL);
}

function normalizeMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  return safe === GOOGLE_CALENDAR_MODES.OAUTH ? GOOGLE_CALENDAR_MODES.OAUTH : GOOGLE_CALENDAR_MODES.DISABLED;
}

export function getGoogleCalendarConfig() {
  const supabaseUrl = readSupabaseUrl();
  const expectedRedirectUri = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/google-calendar-oauth-callback` : "";
  const mode = normalizeMode(readEnv("VITE_GOOGLE_CALENDAR_MODE", GOOGLE_CALENDAR_MODES.OAUTH));
  const clientId = readEnv("VITE_GOOGLE_CLIENT_ID", FALLBACK_GOOGLE_CLIENT_ID);
  const redirectUri = readEnv("VITE_GOOGLE_REDIRECT_URI", expectedRedirectUri);
  const scopes = readEnv("VITE_GOOGLE_CALENDAR_SCOPES")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  return {
    mode,
    provider: "google",
    clientId,
    redirectUri,
    scopes: scopes.length ? scopes : GOOGLE_CALENDAR_DEFAULT_SCOPES,
    enabled: mode !== GOOGLE_CALENDAR_MODES.DISABLED,
    ready: mode === GOOGLE_CALENDAR_MODES.OAUTH && !!clientId && !!redirectUri,
  };
}

export function getGoogleCalendarProviderSnapshot() {
  const config = getGoogleCalendarConfig();
  const supabaseUrl = readSupabaseUrl();
  const expectedCallbackUri = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/google-calendar-oauth-callback` : "";
  return {
    mode: config.mode,
    provider: config.provider,
    enabled: config.enabled,
    ready: config.ready,
    clientConfigured: Boolean(config.clientId),
    redirectConfigured: Boolean(config.redirectUri),
    redirectUri: config.redirectUri,
    expectedCallbackUri,
    redirectMatchesSupabaseCallback: Boolean(config.redirectUri && expectedCallbackUri && config.redirectUri === expectedCallbackUri),
    scopes: config.scopes,
  };
}
