function firstString(...values) {
  return values.map((value) => String(value ?? "").trim()).find(Boolean) || "";
}

function toInteger(value) {
  const normalized = Number(String(value ?? "").trim());
  return Number.isInteger(normalized) ? normalized : null;
}

export function buildSimpleApiRcvPayload({
  tenantId = "",
  operation = "compras",
  period = {},
  credentials = {},
  certificate = {},
} = {}) {
  const normalizedOperation = String(operation || "").trim().toLowerCase();
  const payload = {
    tenantId: firstString(tenantId),
    operation: normalizedOperation,
    period: {
      month: toInteger(period?.month),
      year: toInteger(period?.year),
    },
    credentials: {
      rutCertificado: firstString(credentials?.rutCertificado),
      rutEmpresa: firstString(credentials?.rutEmpresa),
      password: firstString(credentials?.password),
      ambiente: toInteger(credentials?.ambiente ?? 1),
    },
    certificate: {
      base64: firstString(certificate?.base64),
      fileName: firstString(certificate?.fileName) || "certificado.pfx",
      mimeType: firstString(certificate?.mimeType) || "application/x-pkcs12",
    },
  };

  const day = toInteger(period?.day);
  if (day) payload.period.day = day;
  if (normalizedOperation === "ventas" && credentials?.procesaBoletas === true) {
    payload.credentials.procesaBoletas = true;
  }
  return payload;
}

export async function fetchSimpleApiRcvReport(platformApi, options = {}) {
  if (!platformApi?.tax?.fetchSiiRcvReport) {
    return {
      ok: false,
      source: "degraded",
      provider: "simpleapi",
      message: "La capacidad RCV no esta disponible en este entorno.",
    };
  }
  return platformApi.tax.fetchSiiRcvReport(buildSimpleApiRcvPayload(options));
}
