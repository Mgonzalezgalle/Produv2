import { LAB_DATA_CONFIG } from "../lab/labStorageConfig";

const AUTH_STRATEGIES = {
  AUTO: "auto",
  LOCAL: "local",
  SUPABASE: "supabase",
};

function normalizeLabAuthStrategy(value = "") {
  const next = String(value || "").trim().toLowerCase();
  if (next === AUTH_STRATEGIES.AUTO) return AUTH_STRATEGIES.AUTO;
  return next === AUTH_STRATEGIES.SUPABASE ? AUTH_STRATEGIES.SUPABASE : AUTH_STRATEGIES.LOCAL;
}

function readEnvStrategy() {
  try {
    return normalizeLabAuthStrategy(import.meta.env?.VITE_LAB_AUTH_STRATEGY);
  } catch {
    return AUTH_STRATEGIES.AUTO;
  }
}

function hasConfiguredSupabaseAuthEnv() {
  try {
    const url = String(import.meta.env?.VITE_SUPABASE_URL || "").trim();
    const anonKey = String(import.meta.env?.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!url || !anonKey) return false;
    if (anonKey === "your-anon-key") return false;
    return true;
  } catch {
    return false;
  }
}

function resolveAuthStrategy() {
  const strategy = readEnvStrategy();
  if (strategy === AUTH_STRATEGIES.AUTO) {
    return LAB_DATA_CONFIG.releaseMode && hasConfiguredSupabaseAuthEnv()
      ? AUTH_STRATEGIES.SUPABASE
      : AUTH_STRATEGIES.LOCAL;
  }
  return strategy;
}

export const LAB_AUTH_CONFIG = {
  strategy: resolveAuthStrategy(),
  sourceStrategy: readEnvStrategy(),
  allowPasswordReset: true,
  enableGoogleSignIn: String(import.meta.env?.VITE_LAB_GOOGLE_SIGNIN || "false").toLowerCase() === "true",
  enableTwoFactorSetup: String(import.meta.env?.VITE_LAB_MFA || "true").toLowerCase() === "true",
};

export function getLabAuthModeLabel(strategy = LAB_AUTH_CONFIG.strategy) {
  return strategy === AUTH_STRATEGIES.SUPABASE ? "Supabase Auth" : "Auth local";
}

export { AUTH_STRATEGIES };
