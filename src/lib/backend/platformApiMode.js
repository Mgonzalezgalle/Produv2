export const PLATFORM_API_MODES = {
  MOCK: "mock",
  SUPABASE: "supabase",
};

export function getPlatformApiMode() {
  const raw = String(import.meta.env?.VITE_LAB_PLATFORM_API_MODE || PLATFORM_API_MODES.MOCK).trim().toLowerCase();
  return raw === PLATFORM_API_MODES.SUPABASE ? PLATFORM_API_MODES.SUPABASE : PLATFORM_API_MODES.MOCK;
}
