type WebhookPayload = {
  tenantId?: string;
  invoiceId?: string;
  paymentId?: string;
  preferenceId?: string;
  externalReference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  tenantConfig?: {
    accessToken?: string;
    webhookSecret?: string;
  };
  data?: {
    id?: string | number;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function mapMercadoPagoStatus(value = "") {
  const status = String(value || "").toLowerCase();
  if (status === "approved") return { status: "approved", approved: true };
  if (status === "rejected" || status === "cancelled" || status === "cancelado") return { status: "rejected", approved: false };
  return { status: status || "pending", approved: false };
}

function firstSearchResult(data: Record<string, unknown> = {}) {
  const candidates = Array.isArray(data?.results)
    ? (data.results as Record<string, unknown>[])
    : Array.isArray(data?.elements)
      ? (data.elements as Record<string, unknown>[])
      : [];
  return candidates[0] || {};
}

function resolveSearchPaymentResult(data: Record<string, unknown> = {}) {
  const candidates = Array.isArray(data?.results)
    ? (data.results as Record<string, unknown>[])
    : Array.isArray(data?.elements)
      ? (data.elements as Record<string, unknown>[])
      : [];
  const approved = candidates.find(item => String(item?.status || "").toLowerCase() === "approved");
  return approved || candidates[0] || {};
}

function resolvePaymentIdentifier(data: Record<string, unknown> = {}, payload: WebhookPayload = {}, directPaymentId = "") {
  const paymentId = String(data?.id || directPaymentId || "").trim();
  if (paymentId) return paymentId;
  const preferenceId = String((data?.order as Record<string, unknown> | undefined)?.id || payload?.preferenceId || "").trim();
  if (preferenceId) return preferenceId;
  const externalReference = String(data?.external_reference || payload?.externalReference || "").trim();
  if (externalReference) return externalReference;
  return "";
}

async function fetchMercadoPagoPayment(accessToken: string, paymentId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  return { response, data, raw };
}

async function searchMercadoPagoPayment(accessToken: string, payload: WebhookPayload) {
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  const externalReference = String(payload?.externalReference || "").trim();
  const preferenceId = String(payload?.preferenceId || "").trim();
  if (externalReference) url.searchParams.set("external_reference", externalReference);
  if (preferenceId) url.searchParams.set("order.id", preferenceId);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  url.searchParams.set("limit", "10");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  return { response, data, raw };
}

async function searchMercadoPagoMerchantOrder(accessToken: string, payload: WebhookPayload) {
  const url = new URL("https://api.mercadopago.com/merchant_orders/search");
  const externalReference = String(payload?.externalReference || "").trim();
  const preferenceId = String(payload?.preferenceId || "").trim();
  if (externalReference) url.searchParams.set("external_reference", externalReference);
  if (preferenceId) url.searchParams.set("preference_id", preferenceId);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  return { response, data, raw };
}

function resolveMerchantOrderPayment(data: Record<string, unknown> = {}) {
  const order = firstSearchResult(data);
  const payments = Array.isArray(order?.payments) ? (order.payments as Record<string, unknown>[]) : [];
  const approved = payments.find(item => String(item?.status || "").toLowerCase() === "approved") || payments[0] || {};
  return { order, payment: approved };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const payload = await req.json() as WebhookPayload;
  const accessToken =
    String(payload?.tenantConfig?.accessToken || "").trim() ||
    String(Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "").trim();
  const expectedSignature =
    String(payload?.tenantConfig?.webhookSecret || "").trim() ||
    String(Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET") || "").trim();
  const receivedSignature = String(req.headers.get("x-signature") || "").trim();
  const directPaymentId = String(payload?.paymentId || payload?.data?.id || "").trim();
  const directStatus = String(payload?.status || "").trim();

  if (expectedSignature && receivedSignature && expectedSignature !== receivedSignature) {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "invalid_webhook_signature",
      message: "La firma del webhook de Mercado Pago no coincide.",
    }, 401);
  }

  if (directStatus && !directPaymentId) {
    const mapped = mapMercadoPagoStatus(directStatus);
    const fallbackId = resolvePaymentIdentifier({}, payload, "");
    return json({
      ok: true,
      source: "remote",
      provider: "mercadopago",
      paymentResult: {
        status: mapped.status,
        approved: mapped.approved,
        paymentId: fallbackId,
        amount: Number(payload?.amount || 0),
        currency: String(payload?.currency || "CLP").trim() || "CLP",
        preferenceId: String(payload?.preferenceId || "").trim(),
        externalReference: String(payload?.externalReference || "").trim(),
        paidAt: new Date().toISOString(),
        metadata: payload?.metadata || {},
      },
    });
  }

  if (!accessToken) {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "missing_mercadopago_access_token",
      message: "Falta el access token para consultar el pago en Mercado Pago.",
    }, 503);
  }

  let response;
  let data: Record<string, unknown> = {};
  let raw = "";

  if (directPaymentId) {
    const fetched = await fetchMercadoPagoPayment(accessToken, directPaymentId);
    response = fetched.response;
    data = fetched.data;
    raw = fetched.raw;
  } else if (String(payload?.externalReference || "").trim() || String(payload?.preferenceId || "").trim()) {
    const searched = await searchMercadoPagoPayment(accessToken, payload);
    response = searched.response;
    data = searched.data;
    raw = searched.raw;
    if (response.ok) {
      data = resolveSearchPaymentResult(data);
      if (!Object.keys(data || {}).length) {
        const merchantOrder = await searchMercadoPagoMerchantOrder(accessToken, payload);
        if (merchantOrder.response.ok) {
          const resolved = resolveMerchantOrderPayment(merchantOrder.data);
          if (Object.keys(resolved.payment || {}).length) {
            data = {
              ...resolved.payment,
              external_reference: resolved.order?.external_reference || payload?.externalReference || "",
              order: {
                id: resolved.order?.preference_id || payload?.preferenceId || "",
              },
              date_approved: resolved.payment?.date_approved || resolved.order?.last_updated || new Date().toISOString(),
            };
          } else {
            return json({
              ok: false,
              source: "remote",
              provider: "mercadopago",
              error: "mercadopago_payment_not_found",
              message: "Todavía no encontramos un pago aprobado o registrado para este link en Mercado Pago.",
            }, 404);
          }
        } else {
          return json({
            ok: false,
            source: "remote",
            provider: "mercadopago",
            error: "mercadopago_payment_not_found",
            message: "Todavía no encontramos un pago aprobado o registrado para este link en Mercado Pago.",
          }, 404);
        }
      }
    }
  } else {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "missing_payment_lookup_data",
      message: "Falta paymentId, externalReference o preferenceId para consultar el pago.",
    }, 400);
  }

  if (!response.ok) {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "mercadopago_payment_lookup_failed",
      message: String(data?.message || raw || "No pudimos consultar el pago en Mercado Pago."),
      details: data,
    }, 502);
  }

  const mapped = mapMercadoPagoStatus(String(data?.status || ""));
  const resolvedPaymentId = resolvePaymentIdentifier(data, payload, directPaymentId);
  return json({
    ok: true,
    source: "remote",
    provider: "mercadopago",
    paymentResult: {
      status: mapped.status,
      approved: mapped.approved,
      paymentId: resolvedPaymentId,
      amount: Number(data?.transaction_amount || payload?.amount || 0),
      currency: String(data?.currency_id || payload?.currency || "CLP").trim() || "CLP",
      preferenceId: String(data?.order?.id || payload?.preferenceId || "").trim(),
      externalReference: String(data?.external_reference || payload?.externalReference || "").trim(),
      paidAt: String(data?.date_approved || data?.date_created || new Date().toISOString()).trim(),
      metadata: payload?.metadata || {},
      raw: data,
    },
  });
});
