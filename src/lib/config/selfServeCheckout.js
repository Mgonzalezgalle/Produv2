import {
  SELF_SERVE_BASE_PRODUCT,
  SELF_SERVE_PRICE_UNIT,
  buildSelfServePricingSnapshot,
} from "./selfServeCatalog";

export const SELF_SERVE_CHECKOUT_CURRENCY = "CLP";
export const DEFAULT_UF_VALUE_CLP = 39000;

export function getSelfServeUfValueClp(value) {
  const direct = Number(value || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const configured = Number(import.meta.env?.VITE_SELF_SERVE_UF_VALUE_CLP || 0);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_UF_VALUE_CLP;
}

export function convertUfToClp(ufAmount = 0, ufValueClp = getSelfServeUfValueClp()) {
  return Math.round(Number(ufAmount || 0) * Number(ufValueClp || 0));
}

export function formatClp(amount = 0) {
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: SELF_SERVE_CHECKOUT_CURRENCY,
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  } catch {
    return `$${Number(amount || 0).toLocaleString("es-CL")}`;
  }
}

export function buildSelfServeCommercialSummary(pricingSnapshot = buildSelfServePricingSnapshot([]), options = {}) {
  const addons = Array.isArray(pricingSnapshot?.addons) ? pricingSnapshot.addons : [];
  const baseAmount = Number(pricingSnapshot?.base?.monthlyUF || SELF_SERVE_BASE_PRODUCT.monthlyUF || 0);
  const promoBaseAmount = Number(pricingSnapshot?.base?.promoMonthlyUF ?? baseAmount);
  const addonAmount = Number(pricingSnapshot?.addonSubtotalUF || 0);
  const totalUF = Number(pricingSnapshot?.totalUF || baseAmount + addonAmount);
  const promoTotalUF = promoBaseAmount + addonAmount;
  const ufValueClp = getSelfServeUfValueClp(options?.ufValueClp);
  const promoTotalClp = convertUfToClp(promoTotalUF, ufValueClp);
  const totalClp = convertUfToClp(totalUF, ufValueClp);

  return {
    currency: SELF_SERVE_PRICE_UNIT,
    checkoutCurrency: SELF_SERVE_CHECKOUT_CURRENCY,
    ufValueClp,
    baseUF: baseAmount,
    promoBaseUF: promoBaseAmount,
    addonUF: addonAmount,
    promoTotalUF,
    promoTotalClp,
    promoTotalClpFormatted: formatClp(promoTotalClp),
    totalUF,
    totalClp,
    totalClpFormatted: formatClp(totalClp),
    baseLabel: SELF_SERVE_BASE_PRODUCT.label,
    addons,
  };
}

function sanitizeRut(rut = "") {
  return String(rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
}

function buildProductDescription(pricingSnapshot = buildSelfServePricingSnapshot([])) {
  const addons = Array.isArray(pricingSnapshot?.addons) ? pricingSnapshot.addons : [];
  if (!addons.length) return "Base Produ";
  return `Base Produ + ${addons.map(item => item.label).join(", ")}`;
}

export function buildFintocCheckoutPayload({
  acquisitionLead = {},
  pricingSnapshot = acquisitionLead?.pricingSnapshot || buildSelfServePricingSnapshot([]),
  successUrl = "",
  cancelUrl = "",
  webhookUrl = "",
  interval = "month",
  intervalCount = 1,
  ufValueClp = getSelfServeUfValueClp(),
} = {}) {
  const companyDraft = acquisitionLead?.companyDraft || {};
  const adminDraft = acquisitionLead?.adminDraft || {};
  const commercial = buildSelfServeCommercialSummary({
    ...pricingSnapshot,
    totalUF: Number(pricingSnapshot?.totalUF || 0),
  });
  const totalClp = convertUfToClp(commercial.totalUF, ufValueClp);
  const productName = buildProductDescription(pricingSnapshot);
  const companyName = companyDraft?.nombre || acquisitionLead?.emp || "Empresa Produ";
  const adminEmail = adminDraft?.email || acquisitionLead?.ema || companyDraft?.ema || "";

  return {
    flow: "subscription",
    mode: "hosted_redirect",
    referenceId: acquisitionLead?.id || "",
    successUrl,
    cancelUrl,
    webhookUrl,
    customer: {
      name: companyName,
      email: adminEmail,
      phone: adminDraft?.phone || acquisitionLead?.tel || companyDraft?.tel || "",
      taxId: sanitizeRut(companyDraft?.rut || ""),
    },
    subscription: {
      interval,
      intervalCount,
      currency: SELF_SERVE_CHECKOUT_CURRENCY,
      amount: totalClp,
      description: productName,
    },
    metadata: {
      companyDraftId: companyDraft?.id || acquisitionLead?.empresaId || "",
      acquisitionLeadId: acquisitionLead?.id || "",
      checkoutSource: acquisitionLead?.source || "login_self_serve",
      pricingCurrency: SELF_SERVE_PRICE_UNIT,
      ufValueClp,
      baseCode: SELF_SERVE_BASE_PRODUCT.code,
      baseUF: Number(pricingSnapshot?.base?.monthlyUF || SELF_SERVE_BASE_PRODUCT.monthlyUF || 0),
      addonCodes: Array.isArray(pricingSnapshot?.addonCodes) ? pricingSnapshot.addonCodes : [],
      addonSubtotalUF: Number(pricingSnapshot?.addonSubtotalUF || 0),
      totalUF: Number(pricingSnapshot?.totalUF || 0),
      totalClp,
      customerType: acquisitionLead?.customerType || companyDraft?.customerType || "",
      teamSize: acquisitionLead?.teamSize || companyDraft?.teamSize || "",
    },
    internalSummary: {
      productName,
      companyName,
      totalUF: Number(pricingSnapshot?.totalUF || 0),
      totalClp,
      totalClpFormatted: formatClp(totalClp),
    },
  };
}

export function buildSelfServeCheckoutDraft({
  acquisitionLead = {},
  pricingSnapshot = acquisitionLead?.pricingSnapshot || buildSelfServePricingSnapshot([]),
  successUrl = "",
  cancelUrl = "",
  webhookUrl = "",
} = {}) {
  return {
    provider: "fintoc",
    status: "draft",
    pricingSnapshot,
    commercialSummary: buildSelfServeCommercialSummary(pricingSnapshot),
    fintocPayload: buildFintocCheckoutPayload({
      acquisitionLead,
      pricingSnapshot,
      successUrl,
      cancelUrl,
      webhookUrl,
    }),
    createdAt: new Date().toISOString(),
  };
}
