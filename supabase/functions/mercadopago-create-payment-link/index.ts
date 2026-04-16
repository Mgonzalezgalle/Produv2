type PaymentLinkPayload = {
  tenantId?: string;
  invoiceId?: string;
  externalReference?: string;
  amount?: number;
  currency?: string;
  description?: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
  };
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  tenantConfig?: {
    accessToken?: string;
    sellerAccountLabel?: string;
    marketplace?: string;
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

function normalizeAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function resolveCurrency(value: unknown, marketplace: unknown) {
  const site = String(marketplace || "MLC").trim().toUpperCase();
  const siteCurrency =
    site === "MLA" ? "ARS" :
    site === "MLM" ? "MXN" :
    site === "MPE" ? "PEN" :
    site === "MLB" ? "BRL" :
    site === "MLU" ? "UYU" :
    site === "MCO" ? "COP" :
    "CLP";
  const safe = String(value || "").trim().toUpperCase();
  if (!safe || safe === "$" || safe === "PESO" || safe === "PESOS") return siteCurrency;
  if (safe === "PESO CHILENO" || safe === "PESOS CHILENOS") return "CLP";
  if (safe === "PESO ARGENTINO" || safe === "PESOS ARGENTINOS") return "ARS";
  if (safe === "SOL" || safe === "SOLES" || safe === "SOL PERUANO") return "PEN";
  if (safe === "REAL" || safe === "REALES" || safe === "REALES BRASILEÑOS") return "BRL";
  if (safe === "PESO MEXICANO" || safe === "PESOS MEXICANOS") return "MXN";
  if (["CLP", "ARS", "MXN", "PEN", "BRL", "UYU", "COP"].includes(safe)) return safe;
  return siteCurrency;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = await req.json() as PaymentLinkPayload;
  const amount = normalizeAmount(body?.amount);
  const currency = resolveCurrency(body?.currency, body?.tenantConfig?.marketplace);
  const externalReference = String(body?.externalReference || "").trim();
  const description = String(body?.description || "").trim() || "Pago de factura";
  const accessToken =
    String(body?.tenantConfig?.accessToken || "").trim() ||
    String(Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "").trim();

  if (!accessToken) {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "missing_mercadopago_access_token",
      message: "Falta el access token de Mercado Pago para este tenant.",
    }, 503);
  }

  if (!externalReference) {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "missing_external_reference",
      message: "Falta la referencia externa de la factura.",
    }, 400);
  }

  if (!amount) {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "missing_amount",
      message: "El monto del link de pago debe ser mayor a cero.",
    }, 400);
  }

  const preferencePayload = {
    items: [
      {
        title: description,
        quantity: 1,
        currency_id: currency,
        unit_price: amount,
      },
    ],
    payer: body?.customer?.email
      ? {
          email: String(body.customer.email || "").trim(),
          name: String(body.customer.name || "").trim() || undefined,
        }
      : undefined,
    external_reference: externalReference,
    metadata: {
      tenantId: String(body?.tenantId || "").trim(),
      invoiceId: String(body?.invoiceId || "").trim(),
      ...(body?.metadata || {}),
    },
    ...(body?.payload || {}),
  };

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferencePayload),
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "mercadopago_preference_failed",
      message: String(data?.message || raw || "Mercado Pago rechazó la creación de la preferencia."),
      details: data,
    }, 502);
  }

  const paymentLink = {
    provider: "mercadopago",
    mode: "api",
    status: "active",
    preferenceId: String(data?.id || "").trim(),
    externalReference,
    initPoint: String(data?.init_point || "").trim(),
    sandboxInitPoint: String(data?.sandbox_init_point || "").trim(),
    createdAt: new Date().toISOString(),
    expiresAt: String((body?.payload || {})?.expiration_date_to || "").trim(),
    amount,
    currency,
    customerName: String(body?.customer?.name || "").trim(),
    sellerAccountLabel: String(body?.tenantConfig?.sellerAccountLabel || "").trim(),
  };

  return json({
    ok: true,
    source: "remote",
    provider: "mercadopago",
    paymentLink,
    preference: data,
  });
});
