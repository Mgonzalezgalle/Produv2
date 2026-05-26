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
    accessTokenConfigured?: boolean;
    sellerAccountLabel?: string;
    marketplace?: string;
    credentialEnvironment?: string;
    successUrl?: string;
    failureUrl?: string;
    pendingUrl?: string;
    notificationUrl?: string;
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

async function resolveTenantCredential(legacyEmpId = "") {
  const supabaseUrl = String(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const serviceRoleKey = String(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  const safeLegacyEmpId = String(legacyEmpId || "").trim();
  if (!supabaseUrl || !serviceRoleKey || !safeLegacyEmpId) return {};
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_legacy_integration_credential_secret`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        legacy_emp_id: safeLegacyEmpId,
        provider_name: "mercadopago",
        environment_name: "tenant",
      }),
    });
    if (!response.ok) return await resolveLegacyTenantCredential(supabaseUrl, serviceRoleKey, safeLegacyEmpId);
    const data = await response.json();
    if (data && typeof data === "object" && String((data as Record<string, unknown>)?.secretValue || "").trim()) {
      return data as Record<string, unknown>;
    }
    return await resolveLegacyTenantCredential(supabaseUrl, serviceRoleKey, safeLegacyEmpId);
  } catch {
    return await resolveLegacyTenantCredential(supabaseUrl, serviceRoleKey, safeLegacyEmpId);
  }
}

async function resolveLegacyTenantCredential(supabaseUrl: string, serviceRoleKey: string, legacyEmpId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_legacy_storage_item`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ p_key: "produ:empresas" }),
    });
    if (!response.ok) return {};
    const rawValue = await response.json();
    const storedValue = rawValue && typeof rawValue === "object" && "value" in rawValue
      ? (rawValue as Record<string, unknown>).value
      : rawValue;
    const companies = Array.isArray(storedValue) ? storedValue : JSON.parse(String(storedValue || "[]"));
    const tenant = Array.isArray(companies) ? companies.find((company) => String(company?.id || "") === legacyEmpId) : null;
    const config = tenant?.integrationConfigs?.mercadoPago?.tenant || {};
    const secretValue = String(config?.accessToken || "").trim();
    return {
      secretValue,
      config: {
        accessTokenConfigured: config?.accessTokenConfigured === true || Boolean(secretValue),
        credentialEnvironment: config?.credentialEnvironment,
        marketplace: config?.marketplace,
        sellerAccountLabel: config?.sellerAccountLabel,
        successUrl: config?.successUrl,
        failureUrl: config?.failureUrl,
        pendingUrl: config?.pendingUrl,
        notificationUrl: config?.notificationUrl,
      },
    };
  } catch {
    return {};
  }
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

function safeUrl(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function credentialLooksLikeProduction(accessToken: string, credentialEnvironment = "production") {
  if (String(credentialEnvironment || "production").trim() === "test") return true;
  return accessToken.startsWith("APP_USR-");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  const body = await req.json() as PaymentLinkPayload;
  const credential = await resolveTenantCredential(body?.tenantId || "");
  const credentialConfig = credential?.config && typeof credential.config === "object"
    ? credential.config as Record<string, unknown>
    : {};
  const amount = normalizeAmount(body?.amount);
  const marketplace = body?.tenantConfig?.marketplace || credentialConfig?.marketplace;
  const currency = resolveCurrency(body?.currency, marketplace);
  const credentialEnvironment = String(body?.tenantConfig?.credentialEnvironment || credentialConfig?.credentialEnvironment || "production").trim() || "production";
  const externalReference = String(body?.externalReference || "").trim();
  const description = String(body?.description || "").trim() || "Pago de factura";
  const accessToken =
    String(body?.tenantConfig?.accessToken || "").trim() ||
    String(credential?.secretValue || "").trim() ||
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

  if (!credentialLooksLikeProduction(accessToken, credentialEnvironment)) {
    return json({
      ok: false,
      source: "degraded",
      provider: "mercadopago",
      error: "invalid_mercadopago_credential_environment",
      message: "Las credenciales configuradas no parecen ser productivas. Para producción Mercado Pago debe usar credenciales APP_USR.",
    }, 400);
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

  const successUrl = safeUrl(body?.tenantConfig?.successUrl || credentialConfig?.successUrl);
  const failureUrl = safeUrl(body?.tenantConfig?.failureUrl || credentialConfig?.failureUrl);
  const pendingUrl = safeUrl(body?.tenantConfig?.pendingUrl || credentialConfig?.pendingUrl);
  const notificationUrl = safeUrl(body?.tenantConfig?.notificationUrl || credentialConfig?.notificationUrl);
  const backUrls = {
    ...(successUrl ? { success: successUrl } : {}),
    ...(failureUrl ? { failure: failureUrl } : {}),
    ...(pendingUrl ? { pending: pendingUrl } : {}),
  };

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
    ...(Object.keys(backUrls).length ? { back_urls: backUrls, auto_return: successUrl ? "approved" : undefined } : {}),
    ...(notificationUrl ? { notification_url: notificationUrl } : {}),
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

  const initPoint = String(data?.init_point || data?.sandbox_init_point || "").trim();
  const sandboxInitPoint = String(data?.sandbox_init_point || "").trim();
  const paymentLink = {
    provider: "mercadopago",
    mode: "api",
    status: "active",
    preferenceId: String(data?.id || "").trim(),
    externalReference,
    initPoint,
    sandboxInitPoint,
    createdAt: new Date().toISOString(),
    expiresAt: String((body?.payload || {})?.expiration_date_to || "").trim(),
    amount,
    currency,
    customerName: String(body?.customer?.name || "").trim(),
    sellerAccountLabel: String(body?.tenantConfig?.sellerAccountLabel || credentialConfig?.sellerAccountLabel || "").trim(),
  };

  return json({
    ok: true,
    source: "remote",
    provider: "mercadopago",
    paymentLink,
    preference: data,
  });
});
