export const MERCADOPAGO_PAYMENT_MODES = {
  DISABLED: "disabled",
  MOCK: "mock",
  OAUTH: "oauth",
  API: "api",
};

export const MERCADOPAGO_MARKETPLACE_CURRENCY = {
  MLC: "CLP",
  MLA: "ARS",
  MLM: "MXN",
  MPE: "PEN",
  MLB: "BRL",
  MLU: "UYU",
  MCO: "COP",
};

function normalizeMode(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  if (safe === MERCADOPAGO_PAYMENT_MODES.MOCK) return MERCADOPAGO_PAYMENT_MODES.MOCK;
  if (safe === MERCADOPAGO_PAYMENT_MODES.OAUTH) return MERCADOPAGO_PAYMENT_MODES.OAUTH;
  if (safe === MERCADOPAGO_PAYMENT_MODES.API) return MERCADOPAGO_PAYMENT_MODES.API;
  return MERCADOPAGO_PAYMENT_MODES.DISABLED;
}

function readEnv(key, fallback = "") {
  try {
    return String(import.meta.env?.[key] || fallback).trim();
  } catch {
    return String(fallback || "").trim();
  }
}

export function getMercadoPagoPaymentsConfig() {
  const mode = normalizeMode(readEnv("VITE_MERCADOPAGO_MODE", MERCADOPAGO_PAYMENT_MODES.DISABLED));
  const publicKey = readEnv("VITE_MERCADOPAGO_PUBLIC_KEY");
  const appId = readEnv("VITE_MERCADOPAGO_APP_ID");
  const marketplace = readEnv("VITE_MERCADOPAGO_MARKETPLACE", "MLC");
  return {
    mode,
    provider: mode === MERCADOPAGO_PAYMENT_MODES.DISABLED ? "disabled" : "mercadopago",
    publicKey,
    appId,
    marketplace,
    enabled: mode !== MERCADOPAGO_PAYMENT_MODES.DISABLED,
    usesOAuth: mode === MERCADOPAGO_PAYMENT_MODES.OAUTH,
    usesApi: mode === MERCADOPAGO_PAYMENT_MODES.API,
    isMock: mode === MERCADOPAGO_PAYMENT_MODES.MOCK,
    ready: mode === MERCADOPAGO_PAYMENT_MODES.MOCK || ((mode === MERCADOPAGO_PAYMENT_MODES.OAUTH || mode === MERCADOPAGO_PAYMENT_MODES.API) && !!appId),
  };
}

export function resolveMercadoPagoCurrency(value = "", marketplace = "MLC") {
  const safeMarketplace = String(marketplace || "MLC").trim().toUpperCase();
  const safe = String(value || "").trim().toUpperCase();
  const aliases = {
    "$": MERCADOPAGO_MARKETPLACE_CURRENCY[safeMarketplace] || "CLP",
    PESO: MERCADOPAGO_MARKETPLACE_CURRENCY[safeMarketplace] || "CLP",
    PESOS: MERCADOPAGO_MARKETPLACE_CURRENCY[safeMarketplace] || "CLP",
    "PESO CHILENO": "CLP",
    "PESOS CHILENOS": "CLP",
    "PESO ARGENTINO": "ARS",
    "PESOS ARGENTINOS": "ARS",
    SOL: "PEN",
    SOLES: "PEN",
    "SOL PERUANO": "PEN",
    "REALES BRASILEÑOS": "BRL",
    REAL: "BRL",
    REALES: "BRL",
    PESO_MEX: "MXN",
    "PESO MEXICANO": "MXN",
    "PESOS MEXICANOS": "MXN",
  };
  if (aliases[safe]) return aliases[safe];
  if (Object.values(MERCADOPAGO_MARKETPLACE_CURRENCY).includes(safe)) return safe;
  return MERCADOPAGO_MARKETPLACE_CURRENCY[safeMarketplace] || "CLP";
}

export function getMercadoPagoPaymentsProviderSnapshot() {
  const config = getMercadoPagoPaymentsConfig();
  return {
    mode: config.mode,
    provider: config.provider,
    marketplace: config.marketplace,
    enabled: config.enabled,
    ready: config.ready,
    usesOAuth: config.usesOAuth,
    usesApi: config.usesApi,
    isMock: config.isMock,
    appId: config.appId,
    publicKeyConfigured: !!config.publicKey,
  };
}
