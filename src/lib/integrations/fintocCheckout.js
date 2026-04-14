import {
  buildFintocCheckoutPayload,
  buildSelfServeCheckoutDraft,
} from "../config/selfServeCheckout";

export const SELF_SERVE_FINT0C_API_PATH = "/api/billing/self-serve/fintoc/session";
export const SELF_SERVE_FINT0C_PROVIDER = "fintoc";

function buildDefaultUrls() {
  const base =
    String(import.meta.env?.VITE_APP_URL || "").trim()
    || String(import.meta.env?.VITE_PUBLIC_APP_URL || "").trim()
    || "http://127.0.0.1:5174";

  return {
    successUrl: `${base}/checkout/success`,
    cancelUrl: `${base}/checkout/cancel`,
    webhookUrl: `${base}/api/webhooks/fintoc`,
  };
}

export function buildSelfServeFintocSessionRequest({
  acquisitionLead = {},
  pricingSnapshot = acquisitionLead?.pricingSnapshot,
  successUrl,
  cancelUrl,
  webhookUrl,
} = {}) {
  const defaults = buildDefaultUrls();
  const checkoutDraft = buildSelfServeCheckoutDraft({
    acquisitionLead,
    pricingSnapshot,
    successUrl: successUrl || defaults.successUrl,
    cancelUrl: cancelUrl || defaults.cancelUrl,
    webhookUrl: webhookUrl || defaults.webhookUrl,
  });

  return {
    provider: SELF_SERVE_FINT0C_PROVIDER,
    acquisitionLeadId: acquisitionLead?.id || "",
    companyDraftId: acquisitionLead?.companyDraft?.id || acquisitionLead?.empresaId || "",
    requestType: "self_serve_subscription_checkout",
    pricingSnapshot: checkoutDraft.pricingSnapshot,
    commercialSummary: checkoutDraft.commercialSummary,
    payload: checkoutDraft.fintocPayload,
  };
}

export function validateSelfServeFintocSessionRequest(request = {}) {
  const errors = [];
  if (!request?.acquisitionLeadId) errors.push("Falta acquisitionLeadId.");
  if (!request?.companyDraftId) errors.push("Falta companyDraftId.");
  if (!request?.payload?.customer?.name) errors.push("Falta nombre de empresa.");
  if (!request?.payload?.customer?.email) errors.push("Falta email del administrador.");
  if (!Number(request?.payload?.subscription?.amount || 0)) errors.push("Falta monto cobrable.");
  if (!request?.payload?.subscription?.currency) errors.push("Falta currency.");
  return {
    ok: errors.length === 0,
    errors,
  };
}

export function buildMockFintocCheckoutSession(request = {}) {
  const validation = validateSelfServeFintocSessionRequest(request);
  if (!validation.ok) {
    return {
      ok: false,
      error: "No pudimos preparar la sesión de checkout.",
      validation,
    };
  }

  const sessionId = `fintoc_cs_${Math.random().toString(36).slice(2, 10)}`;
  const redirectUrl = `https://checkout.fintoc.mock/session/${sessionId}`;
  return {
    ok: true,
    provider: SELF_SERVE_FINT0C_PROVIDER,
    mode: "mock",
    status: "draft",
    sessionId,
    redirectUrl,
    request,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
  };
}

export async function createSelfServeFintocSession({
  acquisitionLead = {},
  pricingSnapshot = acquisitionLead?.pricingSnapshot,
  mode = "mock",
  successUrl,
  cancelUrl,
  webhookUrl,
} = {}) {
  const request = buildSelfServeFintocSessionRequest({
    acquisitionLead,
    pricingSnapshot,
    successUrl,
    cancelUrl,
    webhookUrl,
  });

  if (mode === "mock") {
    return buildMockFintocCheckoutSession(request);
  }

  return {
    ok: false,
    error: "La sesión real de Fintoc todavía no está conectada en lab.",
    request,
  };
}

export function buildSelfServeFintocApiContract() {
  return {
    method: "POST",
    path: SELF_SERVE_FINT0C_API_PATH,
    requestShape: {
      provider: SELF_SERVE_FINT0C_PROVIDER,
      acquisitionLeadId: "lead_xxx",
      companyDraftId: "emp_xxx",
      requestType: "self_serve_subscription_checkout",
      pricingSnapshot: {
        base: { code: "base_produ", monthlyUF: 1 },
        addonCodes: ["crm", "facturacion"],
        addonSubtotalUF: 9,
        totalUF: 10,
      },
      commercialSummary: {
        totalUF: 10,
        totalClp: 390000,
      },
      payload: buildFintocCheckoutPayload({
        acquisitionLead: {
          id: "lead_xxx",
          empresaId: "emp_xxx",
          emp: "Play Media SpA",
          ema: "admin@empresa.cl",
          tel: "+56 9 1234 5678",
          companyDraft: { id: "emp_xxx", nombre: "Play Media SpA", rut: "77.118.348-2" },
          adminDraft: { email: "admin@empresa.cl" },
        },
        pricingSnapshot: {
          base: { code: "base_produ", monthlyUF: 1 },
          addonCodes: ["crm", "facturacion"],
          addonSubtotalUF: 9,
          totalUF: 10,
        },
      }),
    },
    responseShape: {
      ok: true,
      provider: SELF_SERVE_FINT0C_PROVIDER,
      sessionId: "fintoc_cs_xxx",
      status: "draft",
      redirectUrl: "https://checkout.fintoc.com/...",
      createdAt: "ISO_DATE",
      expiresAt: "ISO_DATE",
    },
  };
}

