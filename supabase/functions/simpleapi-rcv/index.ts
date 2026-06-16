type Operation = "compras" | "ventas";

type Payload = {
  tenantId?: string;
  operation?: string;
  period?: {
    day?: number | string | null;
    month?: number | string | null;
    year?: number | string | null;
  };
  day?: number | string | null;
  month?: number | string | null;
  year?: number | string | null;
  credentials?: {
    rutCertificado?: string;
    rutEmpresa?: string;
    password?: string;
    ambiente?: number | string | null;
    procesaBoletas?: boolean | null;
  };
  certificate?: {
    base64?: string;
    fileName?: string;
    mimeType?: string;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function firstString(...values: unknown[]) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) || "";
}

function toInteger(value: unknown) {
  const normalized = Number(String(value ?? "").trim());
  return Number.isInteger(normalized) ? normalized : null;
}

function normalizeOperation(value: unknown): Operation | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "compras" || normalized === "ventas" ? normalized : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  const raw = firstString(value);
  if (!raw) return {};
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return {};
  }
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
        provider_name: "simpleapi_rcv",
        environment_name: "tenant",
      }),
    });
    if (!response.ok) return {};
    const data = await response.json();
    return asRecord(data);
  } catch {
    return {};
  }
}

function decodeBase64(base64: string) {
  const sanitized = base64.replace(/^data:.*;base64,/, "").trim();
  const binary = atob(sanitized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function buildPeriodPath({
  operation,
  day,
  month,
  year,
}: {
  operation: Operation;
  day: number | null;
  month: number | null;
  year: number | null;
}) {
  if (!month || !year) {
    return { ok: false, error: "missing_period", message: "Debes indicar al menos mes y año para consultar RCV." };
  }
  if (month < 1 || month > 12) {
    return { ok: false, error: "invalid_month", message: "El mes de RCV debe estar entre 1 y 12." };
  }
  if (year < 2000 || year > 2100) {
    return { ok: false, error: "invalid_year", message: "El año de RCV no es valido." };
  }
  if (day == null) {
    return {
      ok: true,
      path: `/api/RCV/${operation}/${String(month).padStart(2, "0")}/${year}`,
      normalizedPeriod: { month, year },
    };
  }
  if (day < 1 || day > 31) {
    return { ok: false, error: "invalid_day", message: "El dia de RCV debe estar entre 1 y 31." };
  }
  return {
    ok: true,
    path: `/api/RCV/${operation}/${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`,
    normalizedPeriod: { day, month, year },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed", message: "La funcion RCV solo acepta POST." }, 405);
  }

  const apiKey = firstString(
    Deno.env.get("SIMPLEAPI_RCV_API_KEY"),
    Deno.env.get("SIMPLEAPI_API_KEY"),
  );
  if (!apiKey) {
    return json({
      ok: false,
      error: "missing_simpleapi_api_key",
      message: "Falta el secreto SIMPLEAPI_RCV_API_KEY en Supabase.",
    }, 503);
  }

  let payload: Payload;
  try {
    payload = await req.json() as Payload;
  } catch {
    return json({ ok: false, error: "invalid_json", message: "El body de RCV debe ser JSON valido." }, 400);
  }

  const operation = normalizeOperation(payload?.operation);
  if (!operation) {
    return json({
      ok: false,
      error: "invalid_operation",
      message: "operation debe ser 'compras' o 'ventas'.",
    }, 400);
  }

  const periodInput = payload?.period && typeof payload.period === "object" ? payload.period : {};
  const day = toInteger(periodInput?.day ?? payload?.day);
  const month = toInteger(periodInput?.month ?? payload?.month);
  const year = toInteger(periodInput?.year ?? payload?.year);
  const period = buildPeriodPath({ operation, day, month, year });
  if (!period.ok) {
    return json({ ok: false, error: period.error, message: period.message }, 400);
  }

  const tenantCredential = await resolveTenantCredential(payload?.tenantId || "");
  const tenantCredentialConfig = asRecord(tenantCredential.config);
  const tenantCredentialSecret = parseJsonObject(tenantCredential.secretValue);
  const credentials = payload?.credentials && typeof payload.credentials === "object" ? payload.credentials : {};
  const rutCertificado = firstString(credentials.rutCertificado, tenantCredentialConfig.rutCertificado);
  const rutEmpresa = firstString(credentials.rutEmpresa, tenantCredentialConfig.rutEmpresa);
  const password = firstString(credentials.password, tenantCredentialSecret.password);
  const ambiente = toInteger(credentials.ambiente ?? tenantCredentialConfig.ambiente ?? 1);
  const procesaBoletas = credentials.procesaBoletas === true || tenantCredentialConfig.procesaBoletas === true;

  if (!rutCertificado || !rutEmpresa || !password) {
    return json({
      ok: false,
      error: "missing_credentials",
      message: "Faltan RutCertificado, RutEmpresa o password para consultar RCV.",
    }, 400);
  }

  if (ambiente !== 0 && ambiente !== 1) {
    return json({
      ok: false,
      error: "invalid_environment",
      message: "Ambiente debe ser 0 para certificacion o 1 para produccion.",
    }, 400);
  }

  const certificate = payload?.certificate && typeof payload.certificate === "object" ? payload.certificate : {};
  const certificateBase64 = firstString(certificate.base64, tenantCredentialSecret.certificateBase64);
  if (!certificateBase64) {
    return json({
      ok: false,
      error: "missing_certificate",
      message: "Debes enviar el certificado PFX en base64 dentro de certificate.base64.",
    }, 400);
  }

  let certificateBytes: Uint8Array;
  try {
    certificateBytes = decodeBase64(certificateBase64);
  } catch {
    return json({
      ok: false,
      error: "invalid_certificate_base64",
      message: "No pudimos decodificar el certificado PFX en base64.",
    }, 400);
  }

  const inputPayload: Record<string, unknown> = {
    RutCertificado: rutCertificado,
    RutEmpresa: rutEmpresa,
    Ambiente: ambiente,
    Password: password,
  };
  if (operation === "ventas" && procesaBoletas) {
    inputPayload.ProcesaBoletas = true;
  }

  const formData = new FormData();
  formData.append("input", JSON.stringify(inputPayload));
  formData.append(
    "files",
    new Blob([certificateBytes], {
      type: firstString(certificate.mimeType, tenantCredentialSecret.certificateMimeType, tenantCredentialConfig.certificateMimeType) || "application/x-pkcs12",
    }),
    firstString(certificate.fileName, tenantCredentialSecret.certificateFileName, tenantCredentialConfig.certificateFileName) || "certificado.pfx",
  );

  const upstreamUrl = `https://servicios.simpleapi.cl${period.path}`;
  const upstreamResponse = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      Authorization: apiKey,
    },
    body: formData,
  });

  const raw = await upstreamResponse.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const message = typeof parsed === "object" && parsed !== null
    ? firstString(
      (parsed as Record<string, unknown>).Mensaje,
      (parsed as Record<string, unknown>).message,
      (parsed as Record<string, unknown>).error,
    )
    : "";

  return json({
    ok: upstreamResponse.ok,
    source: upstreamResponse.ok ? "remote" : "degraded",
    provider: "simpleapi",
    operation,
    period: period.normalizedPeriod,
    status: upstreamResponse.status,
    message: message || (upstreamResponse.ok ? "Consulta RCV completada." : "SimpleAPI rechazo la consulta RCV."),
    data: parsed,
    raw: parsed ? null : raw,
  }, upstreamResponse.status);
});
