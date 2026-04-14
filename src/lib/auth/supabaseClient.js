import { createClient } from "@supabase/supabase-js";

const FALLBACK_SB_URL = "https://zpgxbmlzoxxgymsschrd.supabase.co";
const FALLBACK_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ3hibWx6b3h4Z3ltc3NjaHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTkxODksImV4cCI6MjA5MDM5NTE4OX0.HWIkm-Vm255FFrj07pf3JIYE5MNuZ8tukiLYUDCuZK8";
const SB_URL = String(import.meta.env?.VITE_SUPABASE_URL || FALLBACK_SB_URL).trim();
const SB_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || FALLBACK_SB_KEY).trim();
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
    rpc: disabledResponse,
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
