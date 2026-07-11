import { readSupabaseServiceRoleEnv } from "./supabaseClient.ts";

Deno.test("readSupabaseServiceRoleEnv trims service role configuration", () => {
  const env = readSupabaseServiceRoleEnv((key) => {
    if (key === "SUPABASE_URL") return " https://example.supabase.co/ ";
    if (key === "SUPABASE_SERVICE_ROLE_KEY") return " service-role-key ";
    return "";
  });

  if (env.supabaseUrl !== "https://example.supabase.co/") {
    throw new Error("Expected trimmed Supabase URL");
  }
  if (env.serviceRoleKey !== "service-role-key") {
    throw new Error("Expected trimmed service role key");
  }
});

Deno.test("readSupabaseServiceRoleEnv returns empty strings when missing", () => {
  const env = readSupabaseServiceRoleEnv(() => "");
  if (env.supabaseUrl !== "" || env.serviceRoleKey !== "") {
    throw new Error("Expected empty credentials");
  }
});
