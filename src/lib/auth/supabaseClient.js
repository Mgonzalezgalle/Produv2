import { createClient } from "@supabase/supabase-js";

const FALLBACK_SB_URL = "https://zpgxbmlzoxxgymsschrd.supabase.co";
const FALLBACK_SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ3hibWx6b3h4Z3ltc3NjaHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTkxODksImV4cCI6MjA5MDM5NTE4OX0.HWIkm-Vm255FFrj07pf3JIYE5MNuZ8tukiLYUDCuZK8";
const ENV_SB_URL = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
const ENV_SB_KEY = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
const SB_URL = ENV_SB_URL || FALLBACK_SB_URL;
const SB_KEY = ENV_SB_KEY || FALLBACK_SB_KEY;
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
    functions: {
      invoke: disabledResponse,
    },
  };
}

export const supabaseConfigured = Boolean(SB_URL && SB_KEY);
if (!ENV_SB_URL || !ENV_SB_KEY) {
  console.warn("[supabase] Usando configuración fallback bundled. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el deploy productivo.");
}
if (!supabaseConfigured) {
  console.warn("[supabase] Cliente deshabilitado: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.");
}
export const sb = supabaseConfigured ? createClient(SB_URL, SB_KEY) : createDisabledClient();
