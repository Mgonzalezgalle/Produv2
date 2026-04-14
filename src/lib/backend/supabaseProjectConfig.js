export function getSupabaseProjectConfig() {
  const env = import.meta.env || {};
  return {
    url: String(env.VITE_SUPABASE_URL || "").trim(),
    anonKeyConfigured: Boolean(String(env.VITE_SUPABASE_ANON_KEY || "").trim() && String(env.VITE_SUPABASE_ANON_KEY || "").trim() !== "your-anon-key"),
    labMfaEnabled: String(env.VITE_LAB_MFA || "false").toLowerCase() === "true",
    authStrategy: String(env.VITE_LAB_AUTH_STRATEGY || "auto").trim(),
    projectRef: String(env.VITE_SUPABASE_PROJECT_REF || "").trim(),
    branch: String(env.VITE_SUPABASE_BRANCH || "main").trim(),
    environment: String(env.VITE_SUPABASE_ENVIRONMENT || "lab").trim(),
  };
}

export function describeSupabaseFoundationState() {
  const config = getSupabaseProjectConfig();
  return {
    ...config,
    foundationPhase: "phase_1_foundation",
    domainsReady: [
      "auth",
      "tenants",
      "users",
      "permissions",
    ],
    nextDomains: [
      "checkout",
      "billing",
      "integrations",
    ],
  };
}
