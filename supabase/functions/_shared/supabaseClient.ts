import { createClient } from "npm:@supabase/supabase-js@2";

export type SupabaseServiceRoleClient = ReturnType<typeof createClient>;

export function readSupabaseServiceRoleEnv(getEnv = (key: string) => Deno.env.get(key) || "") {
  return {
    supabaseUrl: String(getEnv("SUPABASE_URL") || "").trim(),
    serviceRoleKey: String(getEnv("SUPABASE_SERVICE_ROLE_KEY") || "").trim(),
  };
}

export function createSupabaseServiceRoleClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): SupabaseServiceRoleClient {
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}
