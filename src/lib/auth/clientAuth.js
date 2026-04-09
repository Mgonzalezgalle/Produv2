import { createClient } from "@supabase/supabase-js";

const FALLBACK_SB_URL = "https://zpgxbmlzoxxgymsschrd.supabase.co";
const FALLBACK_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ3hibWx6b3h4Z3ltc3NjaHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTkxODksImV4cCI6MjA5MDM5NTE4OX0.HWIkm-Vm255FFrj07pf3JIYE5MNuZ8tukiLYUDCuZK8";
const SB_URL = String(import.meta.env?.VITE_SUPABASE_URL || FALLBACK_SB_URL).trim();
const SB_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || FALLBACK_SB_KEY).trim();
const HASH_RE = /^[a-f0-9]{64}$/i;
const SUPABASE_CONFIG_ERROR = new Error("Supabase client not configured");

function disabledResponse() {
  return Promise.resolve({ data: null, error: SUPABASE_CONFIG_ERROR });
}

function createDisabledClient() {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: disabledResponse,
              };
            },
          };
        },
        upsert: disabledResponse,
      };
    },
    auth: {
      signInWithPassword: disabledResponse,
      signOut: () => Promise.resolve({ error: null }),
      signUp: disabledResponse,
      getSession: () => Promise.resolve({ data: { session: null }, error: SUPABASE_CONFIG_ERROR }),
      resetPasswordForEmail: disabledResponse,
      signInWithOAuth: disabledResponse,
    },
  };
}

export const supabaseConfigured = Boolean(SB_URL && SB_KEY);
export const sb = supabaseConfigured ? createClient(SB_URL, SB_KEY) : createDisabledClient();

export async function dbGet(key) {
  try {
    const { data, error } = await sb.from("storage").select("value").eq("key", key).maybeSingle();
    if (error || !data) return null;
    return JSON.parse(data.value);
  } catch {
    return null;
  }
}

export async function dbSet(key, val) {
  try {
    const { error } = await sb.from("storage").upsert({ key, value: JSON.stringify(val) }, { onConflict: "key" });
    return !error;
  } catch {
    return false;
  }
}

export async function sha256Hex(text = "") {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function isPasswordHash(v = "") {
  return HASH_RE.test(String(v || ""));
}

export async function normalizeUserAuth(user = {}) {
  const { password, ...rest } = user || {};
  const passwordHash = user.passwordHash
    ? user.passwordHash
    : user.password
      ? await sha256Hex(user.password)
      : "";
  return {
    ...rest,
    passwordHash,
  };
}

export async function normalizeUsersAuth(users = []) {
  return Promise.all((Array.isArray(users) ? users : []).filter(Boolean).map(normalizeUserAuth));
}
