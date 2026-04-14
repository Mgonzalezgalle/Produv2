import { createClient } from "@supabase/supabase-js";

const SB_URL = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
const SB_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
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
