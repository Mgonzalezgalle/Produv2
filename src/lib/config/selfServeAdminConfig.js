export const SELF_SERVE_SETTINGS_KEY = "produ:selfServeSettings";

export const DEFAULT_SELF_SERVE_SETTINGS = {
  assistedOnly: true,
  basePlanLabel: "Plan Starter",
  basePlanShortLabel: "Starter",
  baseMonthlyUF: 1,
  promoMonthlyUF: 0,
  promoMonths: 3,
  ufValueClp: 39000,
  addonPrices: {},
  addonOverrides: {},
};

export function normalizeSelfServeSettings(raw = {}) {
  const rawAddonPrices = raw?.addonPrices && typeof raw.addonPrices === "object" ? raw.addonPrices : {};
  const rawAddonOverrides = raw?.addonOverrides && typeof raw.addonOverrides === "object" ? raw.addonOverrides : {};
  return {
    assistedOnly: raw?.assistedOnly !== false,
    basePlanLabel: String(raw?.basePlanLabel || DEFAULT_SELF_SERVE_SETTINGS.basePlanLabel).trim() || DEFAULT_SELF_SERVE_SETTINGS.basePlanLabel,
    basePlanShortLabel: String(raw?.basePlanShortLabel || DEFAULT_SELF_SERVE_SETTINGS.basePlanShortLabel).trim() || DEFAULT_SELF_SERVE_SETTINGS.basePlanShortLabel,
    baseMonthlyUF: Math.max(0, Number(raw?.baseMonthlyUF ?? DEFAULT_SELF_SERVE_SETTINGS.baseMonthlyUF) || 0),
    promoMonthlyUF: Math.max(0, Number(raw?.promoMonthlyUF ?? DEFAULT_SELF_SERVE_SETTINGS.promoMonthlyUF) || 0),
    promoMonths: Math.max(0, Number(raw?.promoMonths ?? DEFAULT_SELF_SERVE_SETTINGS.promoMonths) || 0),
    ufValueClp: Math.max(0, Number(raw?.ufValueClp ?? DEFAULT_SELF_SERVE_SETTINGS.ufValueClp) || 0),
    addonPrices: Object.fromEntries(
      Object.entries(rawAddonPrices).map(([code, value]) => [code, Math.max(0, Number(value || 0) || 0)]),
    ),
    addonOverrides: Object.fromEntries(
      Object.entries(rawAddonOverrides).map(([code, value]) => [
        code,
        {
          label: String(value?.label || "").trim(),
          badge: String(value?.badge || "").trim(),
          audience: String(value?.audience || "").trim(),
          description: String(value?.description || "").trim(),
        },
      ]),
    ),
  };
}
