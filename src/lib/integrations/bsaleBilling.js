import { getProduBillingDocumentCodeSii } from "./billingDomain";

export const BSALE_SANDBOX_BASE_URL = "https://api.bsale.io/v1";
export const BSALE_PRODUCTION_BASE_URL = "https://api.bsale.io/v1";

export function getBsaleBillingConfig() {
  const env = import.meta.env || {};
  const mode = String(env.VITE_BSALE_MODE || "sandbox").trim().toLowerCase();
  const token = String(env.VITE_BSALE_ACCESS_TOKEN || "").trim();
  const officeId = String(env.VITE_BSALE_OFFICE_ID || "").trim();
  const priceListId = String(env.VITE_BSALE_PRICE_LIST_ID || "").trim();
  const documentTypeId = String(env.VITE_BSALE_DOCUMENT_TYPE_ID || "").trim();

  return {
    provider: "bsale",
    mode,
    baseUrl: mode === "production" ? BSALE_PRODUCTION_BASE_URL : BSALE_SANDBOX_BASE_URL,
    token,
    officeId,
    priceListId,
    documentTypeId,
    hasCredentials: Boolean(token),
  };
}

function readTenantBsaleOverride(empresa = {}, mode = "sandbox") {
  const integrations = empresa?.integrationConfigs || empresa?.metadata?.integrationConfigs || {};
  const providerConfig = integrations?.bsale || {};
  return providerConfig?.[mode] || null;
}

export function getBsaleBillingTenantConfig(empresa = {}, fallbackConfig = getBsaleBillingConfig()) {
  const override = readTenantBsaleOverride(empresa, fallbackConfig.mode) || {};
  const token = String(override.token || fallbackConfig.token || "").trim();
  const officeId = String(override.officeId || fallbackConfig.officeId || "").trim();
  const priceListId = String(override.priceListId || fallbackConfig.priceListId || "").trim();
  const documentTypeId = String(override.documentTypeId || fallbackConfig.documentTypeId || "").trim();
  return {
    ...fallbackConfig,
    token,
    officeId,
    priceListId,
    documentTypeId,
    status: String(override.status || "draft").trim() || "draft",
    source: override.token ? "tenant" : "environment",
    hasCredentials: Boolean(token),
  };
}

export function buildBsaleAuthHeaders(config = getBsaleBillingConfig()) {
  return {
    "Content-Type": "application/json",
    access_token: config.token || "",
  };
}

function toBsaleUnixDate(value) {
  if (!value) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  return Math.trunc(date.getTime() / 1000);
}

function buildBsaleClientPayload({ factura = {}, cliente = {} } = {}) {
  const primaryContact = Array.isArray(cliente.contactos) ? (cliente.contactos[0] || {}) : {};
  const code = String(cliente.rut || factura.rut || "").trim();
  const email = String(
    cliente.email
    || cliente.ema
    || primaryContact.email
    || primaryContact.ema
    || factura.email
    || ""
  ).trim();
  const company = String(
    cliente.nombre
    || cliente.nom
    || cliente.razonSocial
    || factura.clienteNombre
    || factura.razonSocial
    || factura.entidad
    || factura.nom
    || ""
  ).trim();
  const address = String(cliente.direccion || cliente.dir || factura.direccion || "").trim();
  const city = String(cliente.ciudad || cliente.city || factura.ciudad || factura.city || "").trim();
  const municipality = String(
    cliente.comuna
    || cliente.municipality
    || factura.comuna
    || factura.municipality
    || city
  ).trim();
  const activity = String(cliente.giro || factura.giro || "Servicios").trim();
  const phone = String(
    cliente.telefono
    || cliente.tel
    || primaryContact.telefono
    || primaryContact.tel
    || factura.telefono
    || ""
  ).trim();

  const payload = {
    code,
    city,
    company,
    municipality,
    activity,
    address,
    email,
    phone,
    companyOrPerson: 1,
  };

  return Object.fromEntries(Object.entries(payload).filter(([, val]) => val !== "" && val !== undefined && val !== null));
}

export function validateBsaleClientPayload(payload = {}) {
  const missing = [];
  if (!String(payload.code || "").trim()) missing.push("RUT");
  if (!String(payload.company || "").trim()) missing.push("Razón social / nombre");
  if (!String(payload.city || "").trim()) missing.push("Ciudad");
  if (!String(payload.municipality || "").trim()) missing.push("Comuna / municipio");
  if (!String(payload.address || "").trim()) missing.push("Dirección");
  return {
    valid: missing.length === 0,
    missing,
  };
}

function buildBsaleDetails(lineItems = []) {
  return (Array.isArray(lineItems) ? lineItems : []).map((item, index) => {
    const netUnitValue = Number(item.netUnitValue || item.unitValue || item.valorUnitario || 0);
    const quantity = Number(item.quantity || item.cantidad || 1);
    const comment = String(item.comment || item.descripcion || `Item ${index + 1}`).trim();
    const taxId = Number(item.taxId || 0) || undefined;
    const taxes = Array.isArray(item.taxes) ? item.taxes : [];
    return {
      netUnitValue,
      quantity,
      comment,
      taxId,
      taxes: taxes.length ? taxes : undefined,
    };
  }).filter(item => item.netUnitValue > 0 && item.quantity > 0);
}

function compactObject(obj = {}) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function buildBsaleReferences(references = []) {
  return (Array.isArray(references) ? references : [])
    .map((item) => compactObject({
      number: item.number || item.folio || item.referenceNumber || "",
      referenceDate: toBsaleUnixDate(item.referenceDate || item.date || item.fecha || ""),
      reason: item.reason || item.glosa || "Documento relacionado",
      codeSii: Number(
        item.codeSii
        || ((item.documentTypeCode || item.relatedDocumentTypeCode || "") === "orden_compra" ? 801 : 0)
        || getProduBillingDocumentCodeSii(item.documentTypeCode || item.relatedDocumentTypeCode || "")
      ) || undefined,
    }))
    .filter((item) => item.number);
}

export function buildBsaleInvoiceRequest({
  factura = {},
  empresa = {},
  cliente = {},
  lineItems = [],
  references = [],
  config = getBsaleBillingConfig(),
} = {}) {
  const emissionDate = toBsaleUnixDate(
    factura.fechaEmision
    || factura.fecha
    || new Date().toISOString().slice(0, 10),
  );
  const expirationDate = toBsaleUnixDate(factura.fechaVencimiento || factura.fechaEmision || factura.fecha);
  const details = buildBsaleDetails(lineItems);
  const client = buildBsaleClientPayload({ factura, cliente });
  const clientValidation = validateBsaleClientPayload(client);
  if (!clientValidation.valid) {
    throw new Error(`Cliente incompleto para Bsale: faltan ${clientValidation.missing.join(", ")}.`);
  }
  const normalizedReferences = buildBsaleReferences(references);
  const normalizedClient = {
    ...client,
    company: String(
      client.company
      || cliente.nom
      || cliente.nombre
      || cliente.razonSocial
      || factura.clienteNombre
      || factura.razonSocial
      || factura.entidad
      || factura.nom
      || ""
    ).trim(),
  };

  return compactObject({
    clientId: factura.clientId ? Number(factura.clientId) : undefined,
    officeId: config.officeId ? Number(config.officeId) : undefined,
    documentTypeId: config.documentTypeId ? Number(config.documentTypeId) : undefined,
    priceListId: config.priceListId ? Number(config.priceListId) : undefined,
    emissionDate,
    expirationDate,
    declareSii: 1,
    client: factura.clientId ? undefined : normalizedClient,
    sendEmail: normalizedClient.email ? 1 : undefined,
    details,
    references: normalizedReferences.length ? normalizedReferences : undefined,
    observation: String(factura.obs || factura.glosa || "").trim() || undefined,
    metadata: {
      produCompanyId: empresa.id || factura.empId || "",
      produInvoiceId: factura.id || "",
      produDocumentType: factura.tipoDoc || "Factura",
      produBillingActionMode: "manual",
    },
  });
}

export function buildBsaleBillingApiContract(config = getBsaleBillingConfig()) {
  return {
    provider: "bsale",
    mode: config.mode,
    baseUrl: config.baseUrl,
    credentials: {
      tokenConfigured: config.hasCredentials,
      officeIdConfigured: Boolean(config.officeId),
      documentTypeConfigured: Boolean(config.documentTypeId),
      priceListConfigured: Boolean(config.priceListId),
    },
    endpoints: {
      createDocument: {
        method: "POST",
        path: "/documents.json",
      },
      getDocument: {
        method: "GET",
        path: "/documents/{id}.json",
      },
      getDocumentDetails: {
        method: "GET",
        path: "/documents/{id}/details.json",
      },
      createReturn: {
        method: "POST",
        path: "/returns.json",
      },
      listPayments: {
        method: "GET",
        path: "/payments.json",
      },
      listPaymentTypes: {
        method: "GET",
        path: "/payment_types.json",
      },
      listDocumentTypes: {
        method: "GET",
        path: "/document_types.json",
      },
      listOffices: {
        method: "GET",
        path: "/offices.json",
      },
      listClients: {
        method: "GET",
        path: "/clients.json",
      },
      listProductTypes: {
        method: "GET",
        path: "/product_types.json",
      },
      createProductType: {
        method: "POST",
        path: "/product_types.json",
      },
      listProducts: {
        method: "GET",
        path: "/products.json",
      },
      createProduct: {
        method: "POST",
        path: "/products.json",
      },
      createClient: {
        method: "POST",
        path: "/clients.json",
      },
      updateClient: {
        method: "PUT",
        path: "/clients/{id}.json",
      },
    },
    notes: [
      "Primera etapa: emisión manual desde Produ.",
      "Lista de precios no configurada en sandbox por ahora.",
    ],
  };
}

function normalizeBsaleText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function listBsaleDocumentTypes(config = getBsaleBillingConfig()) {
  return bsaleApiFetch("/document_types.json?limit=100", {
    method: "GET",
    config,
  });
}

export async function listBsaleTaxes(config = getBsaleBillingConfig()) {
  return bsaleApiFetch("/taxes.json?limit=100&state=0", {
    method: "GET",
    config,
  });
}

export async function listBsalePayments({ documentId = "", config = getBsaleBillingConfig() } = {}) {
  const query = documentId ? `?limit=100&documentid=${encodeURIComponent(documentId)}` : "?limit=100";
  return bsaleApiFetch(`/payments.json${query}`, {
    method: "GET",
    config,
  });
}

export async function listBsalePaymentTypes(config = getBsaleBillingConfig()) {
  return bsaleApiFetch("/payment_types.json?limit=100&state=0", {
    method: "GET",
    config,
  });
}

export async function listBsaleOffices(config = getBsaleBillingConfig()) {
  return bsaleApiFetch("/offices.json?limit=100", {
    method: "GET",
    config,
  });
}

export async function listBsaleClients({ code = "", config = getBsaleBillingConfig() } = {}) {
  const query = code ? `?limit=50&code=${encodeURIComponent(code)}` : "?limit=50";
  return bsaleApiFetch(`/clients.json${query}`, {
    method: "GET",
    config,
  });
}

export async function listBsaleProductTypes({ name = "", config = getBsaleBillingConfig() } = {}) {
  const query = name ? `?limit=50&name=${encodeURIComponent(name)}&state=0` : "?limit=50&state=0";
  return bsaleApiFetch(`/product_types.json${query}`, {
    method: "GET",
    config,
  });
}

export async function createBsaleProductType(payload, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch("/product_types.json", {
    method: "POST",
    body: payload,
    config,
  });
}

export async function listBsaleProducts({ name = "", productTypeId = "", config = getBsaleBillingConfig() } = {}) {
  const params = new URLSearchParams();
  params.set("limit", "50");
  params.set("state", "0");
  if (name) params.set("name", name);
  if (productTypeId) params.set("producttypeid", String(productTypeId));
  return bsaleApiFetch(`/products.json?${params.toString()}`, {
    method: "GET",
    config,
  });
}

export async function createBsaleProduct(payload, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch("/products.json", {
    method: "POST",
    body: payload,
    config,
  });
}

export async function createBsaleClient(payload, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch("/clients.json", {
    method: "POST",
    body: payload,
    config,
  });
}

export async function updateBsaleClient(clientId, payload, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch(`/clients/${clientId}.json`, {
    method: "PUT",
    body: payload,
    config,
  });
}

export function resolveBsaleOfficeIdFromCatalog(officesPayload = {}, configuredOfficeId = "") {
  const items = Array.isArray(officesPayload?.items) ? officesPayload.items : [];
  const configured = configuredOfficeId ? Number(configuredOfficeId) : null;
  if (configured && items.some(item => Number(item.id) === configured)) return configured;
  const activeOffice = items.find(item => Number(item.state ?? 1) !== 0) || items[0];
  return activeOffice ? Number(activeOffice.id) : undefined;
}

const BSALE_DOCUMENT_TYPE_MATCHERS = {
  factura_afecta: ["[5] factura electronica", "(119) factura electronica", "factura electronica"],
  factura_exenta: ["[15] factura no afecta o exenta electronica", "factura no afecta o exenta electronica", "factura exenta"],
  boleta_afecta: ["[1] boleta electronica", "boleta electronica"],
  boleta_exenta: ["[28] boleta no afecta o exenta electronica", "boleta no afecta o exenta electronica"],
  nota_credito: ["[2] nota de credito electronica", "nota de credito electronica"],
  nota_debito: ["[17] nota de debito electronica", "nota de debito electronica"],
  guia_despacho: ["[7] guia de despacho electronica", "[8] guia de despacho electronica", "guia de despacho electronica"],
};

export function resolveBsaleDocumentTypeIdFromCatalog(produDocumentType = "", documentTypesPayload = {}, fallbackDocumentTypeId = "") {
  const items = Array.isArray(documentTypesPayload?.items) ? documentTypesPayload.items : [];
  const configured = fallbackDocumentTypeId ? Number(fallbackDocumentTypeId) : null;
  if (configured && items.some(item => Number(item.id) === configured)) return configured;

  const patterns = BSALE_DOCUMENT_TYPE_MATCHERS[produDocumentType] || [];
  const normalizedItems = items.map(item => ({
    id: Number(item.id),
    name: item.name || "",
    normalized: normalizeBsaleText(item.name || ""),
  }));

  for (const pattern of patterns) {
    const normalizedPattern = normalizeBsaleText(pattern);
    const matches = normalizedItems
      .filter(item => item.normalized.includes(normalizedPattern))
      .sort((a, b) => {
        const aBracketed = a.name.trim().startsWith("[") ? 0 : 1;
        const bBracketed = b.name.trim().startsWith("[") ? 0 : 1;
        if (aBracketed !== bBracketed) return aBracketed - bBracketed;
        if (a.normalized.length !== b.normalized.length) return a.normalized.length - b.normalized.length;
        return Number(a.id || 0) - Number(b.id || 0);
      });
    const hit = matches[0];
    if (hit?.id) return hit.id;
  }

  return configured || undefined;
}

export function resolveBsaleTaxFromCatalog({ factura = {}, taxesPayload = {} } = {}) {
  const items = Array.isArray(taxesPayload?.items) ? taxesPayload.items : [];
  if (factura?.iva) {
    const iva = items.find((item) => (
      Number(item.code ?? 0) === 14
      || normalizeBsaleText(item.name || "") === "iva"
      || Number(item.percentage ?? item.value ?? 0) === 19
    ));
    if (iva) {
      return {
        id: Number(iva.id || 0) || undefined,
        code: Number(iva.code || 14) || 14,
        percentage: Number(iva.percentage ?? 19) || 19,
        name: iva.name || "IVA",
      };
    }
    return {
      id: undefined,
      code: 14,
      percentage: 19,
      name: "IVA",
    };
  }
  return null;
}

export function resolveBsaleProductTypeIdFromCatalog(productTypesPayload = {}, preferredName = "Servicios Produ") {
  const items = Array.isArray(productTypesPayload?.items) ? productTypesPayload.items : [];
  const normalizedPreferred = normalizeBsaleText(preferredName);
  const exact = items.find((item) => normalizeBsaleText(item.name || "") === normalizedPreferred && Number(item.state ?? 0) === 0);
  if (exact?.id) return Number(exact.id);
  const fallback = items.find((item) => normalizeBsaleText(item.name || "") === normalizeBsaleText("Sin Tipo de Producto") && Number(item.state ?? 0) === 0);
  if (fallback?.id) return Number(fallback.id);
  const active = items.find((item) => Number(item.state ?? 0) === 0);
  return active?.id ? Number(active.id) : undefined;
}

export function buildBsaleServiceProductPayload({ item = {}, productTypeId } = {}) {
  return compactObject({
    name: String(item.descripcion || item.desc || "").trim(),
    description: String(item.descripcion || item.desc || "").trim(),
    classification: 1,
    allowDecimal: 1,
    stockControl: 0,
    productTypeId: productTypeId ? Number(productTypeId) : undefined,
  });
}

export async function ensureBsaleProductType({ name = "Servicios Produ", config = getBsaleBillingConfig() } = {}) {
  const catalog = await listBsaleProductTypes({ name, config });
  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  const exact = items.find((item) => normalizeBsaleText(item.name || "") === normalizeBsaleText(name) && Number(item.state ?? 0) === 0);
  if (exact?.id) return exact;
  const created = await createBsaleProductType({ name }, config);
  return created;
}

export async function ensureBsaleServiceCatalogItems({
  lineItems = [],
  config = getBsaleBillingConfig(),
  preferredProductTypeName = "Servicios Produ",
} = {}) {
  const normalizedItems = (Array.isArray(lineItems) ? lineItems : [])
    .map((item, index) => ({
      ...item,
      descripcion: String(item.descripcion || item.comment || item.desc || `Item ${index + 1}`).trim(),
      quantity: Number(item.quantity || item.qty || 0),
      netUnitValue: Number(item.netUnitValue || item.precio || item.unitValue || 0),
    }))
    .filter((item) => item.descripcion && item.quantity > 0 && item.netUnitValue > 0);

  if (!normalizedItems.length) return [];

  const productType = await ensureBsaleProductType({ name: preferredProductTypeName, config });
  const productTypeId = Number(productType?.id || 0) || resolveBsaleProductTypeIdFromCatalog({ items: [productType] }, preferredProductTypeName);

  const enriched = [];
  for (const item of normalizedItems) {
    const existingPayload = await listBsaleProducts({
      name: item.descripcion,
      productTypeId,
      config,
    });
    const existingItems = Array.isArray(existingPayload?.items) ? existingPayload.items : [];
    let product = existingItems.find((entry) => normalizeBsaleText(entry.name || "") === normalizeBsaleText(item.descripcion));
    if (!product) {
      product = await createBsaleProduct(buildBsaleServiceProductPayload({
        item,
        productTypeId,
      }), config);
    }
    enriched.push({
      ...item,
      bsaleProductId: Number(product?.id || 0) || undefined,
      bsaleProductTypeId: productTypeId || undefined,
      bsaleProductName: product?.name || item.descripcion,
    });
  }

  return enriched;
}

export async function bsaleApiFetch(path, { method = "GET", body, config = getBsaleBillingConfig() } = {}) {
  const url = `${config.baseUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: buildBsaleAuthHeaders(config),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!response.ok) {
    const message = typeof data === "object" && data
      ? data.message || data.error || `Bsale respondió ${response.status}`
      : `Bsale respondió ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export async function createBsaleDocument(payload, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch("/documents.json", {
    method: "POST",
    body: payload,
    config,
  });
}

export async function getBsaleDocument(documentId, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch(`/documents/${documentId}.json?expand=document_type,client,office,details`, {
    method: "GET",
    config,
  });
}

export async function getBsaleDocumentDetails(documentId, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch(`/documents/${documentId}/details.json`, {
    method: "GET",
    config,
  });
}

export function buildBsaleReturnRequest({
  factura = {},
  empresa = {},
  cliente = {},
  referenceDocument = {},
  referenceDetails = [],
  config = getBsaleBillingConfig(),
} = {}) {
  const emissionDate = toBsaleUnixDate(
    factura.fechaEmision
    || factura.fecha
    || new Date().toISOString().slice(0, 10),
  );
  const expirationDate = toBsaleUnixDate(factura.fechaVencimiento || factura.fechaEmision || factura.fecha);
  const client = buildBsaleClientPayload({ factura, cliente });
  const clientValidation = validateBsaleClientPayload(client);
  if (!clientValidation.valid) {
    throw new Error(`Cliente incompleto para Bsale: faltan ${clientValidation.missing.join(", ")}.`);
  }
  const normalizedClient = {
    ...client,
    company: String(
      client.company
      || cliente.nom
      || cliente.nombre
      || cliente.razonSocial
      || factura.clienteNombre
      || factura.razonSocial
      || factura.entidad
      || factura.nom
      || ""
    ).trim(),
  };
  const details = Array.isArray(referenceDetails) ? referenceDetails : [];
  const referenceTotal = Number(referenceDocument?.netAmount || referenceDocument?.totalAmount || 0);
  const requestedTotal = Number(factura?.montoNeto || factura?.subtotal || factura?.neto || factura?.total || 0);
  const primaryDetail = details[0] || {};
  const originalQuantity = Number(primaryDetail.quantity || 1) || 1;
  const originalUnitValue = Number(primaryDetail.netUnitValue || primaryDetail.unitValue || referenceTotal || 0);
  const isPriceAdjustment = requestedTotal > 0 && referenceTotal > 0 && requestedTotal < referenceTotal;
  const adjustedUnitValue = Math.max(
    0,
    originalUnitValue - (requestedTotal / Math.max(originalQuantity, 1)),
  );

  return compactObject({
    documentTypeId: config.documentTypeId ? Number(config.documentTypeId) : undefined,
    officeId: config.officeId
      ? Number(config.officeId)
      : (referenceDocument?.office?.id ? Number(referenceDocument.office.id) : undefined),
    clientId: factura.clientId ? Number(factura.clientId) : undefined,
    referenceDocumentId: Number(referenceDocument?.id || 0) || undefined,
    emissionDate,
    expirationDate,
    motive: String(factura.relatedDocumentReason || factura.obs || "Devolución").trim(),
    declareSii: 1,
    priceAdjustment: isPriceAdjustment ? 1 : 0,
    editTexts: 0,
    type: 1,
    client: factura.clientId ? undefined : normalizedClient,
    details: primaryDetail?.id ? [{
      documentDetailId: Number(primaryDetail.id),
      quantity: isPriceAdjustment ? 0 : originalQuantity,
      unitValue: isPriceAdjustment ? adjustedUnitValue : 0,
      comment: String(factura.obs || factura.glosa || "").trim() || undefined,
    }] : undefined,
  });
}

export async function createBsaleReturn(payload, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch("/returns.json", {
    method: "POST",
    body: payload,
    config,
  });
}

export async function getBsaleReturn(returnId, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch(`/returns/${returnId}.json?expand=reference_document,credit_note,details`, {
    method: "GET",
    config,
  });
}

export function buildBsaleReturnAnnulmentRequest({
  factura = {},
  creditNoteDocument = {},
  config = getBsaleBillingConfig(),
} = {}) {
  const emissionDate = toBsaleUnixDate(
    factura.fechaEmision
    || factura.fecha
    || new Date().toISOString().slice(0, 10),
  );
  const expirationDate = toBsaleUnixDate(factura.fechaVencimiento || factura.fechaEmision || factura.fecha);
  return compactObject({
    documentTypeId: config.documentTypeId ? Number(config.documentTypeId) : undefined,
    referenceDocumentId: Number(creditNoteDocument?.id || 0) || undefined,
    emissionDate,
    expirationDate,
    declareSii: 1,
  });
}

export async function createBsaleReturnAnnulment(returnId, payload, config = getBsaleBillingConfig()) {
  if (!config.hasCredentials) {
    throw new Error("Bsale no tiene credenciales configuradas en este entorno.");
  }
  return bsaleApiFetch(`/returns/${returnId}/annulments.json`, {
    method: "POST",
    body: payload,
    config,
  });
}

export function buildExternalSyncFromBsaleDocument(document = {}, previousSync = {}) {
  const informedSii = Number(document?.informedSii ?? document?.informed_sii ?? 0);
  const providerStatus = informedSii === 0 ? "pending" : informedSii === 1 ? "processing" : informedSii === 2 ? "accepted" : "unknown";
  const netAmount = Number(document?.netAmount ?? document?.net_amount ?? 0);
  const taxAmount = Number(document?.taxAmount ?? document?.tax_amount ?? 0);
  const totalAmount = Number(document?.totalAmount ?? document?.total_amount ?? 0);
  return {
    provider: "bsale",
    mode: "manual",
    status: providerStatus === "accepted" ? "synced" : "pending",
    sessionId: previousSync?.sessionId || "",
    requestedAt: previousSync?.requestedAt || new Date().toISOString(),
    syncedAt: new Date().toISOString(),
    externalDocumentId: String(document?.id || previousSync?.externalDocumentId || ""),
    externalFolio: document?.number ?? previousSync?.externalFolio ?? "",
    providerStatus,
    providerMessage: document?.responseMsgSii || document?.responseMsg || "",
    documentTypeName: document?.document_type?.name || previousSync?.documentTypeName || "",
    netAmount,
    taxAmount,
    totalAmount,
    href: document?.href || "",
    publicViewUrl: document?.urlPublicView || "",
    pdfUrl: document?.urlPdf || "",
  };
}

export function buildProduBillingAmountsFromBsaleDocument(document = {}, factura = {}) {
  const netAmount = Number(document?.netAmount ?? document?.net_amount ?? factura?.montoNeto ?? factura?.subtotal ?? factura?.neto ?? 0);
  const taxAmount = Number(document?.taxAmount ?? document?.tax_amount ?? factura?.ivaVal ?? 0);
  const totalAmount = Number(document?.totalAmount ?? document?.total_amount ?? factura?.total ?? (netAmount + taxAmount));
  return {
    montoNeto: netAmount,
    subtotal: netAmount,
    neto: netAmount,
    ivaVal: taxAmount,
    total: totalAmount,
  };
}

export function mapBsalePaymentsToProduReceipts({ paymentsPayload = {}, factura = {}, empId = "" } = {}) {
  const items = Array.isArray(paymentsPayload?.items) ? paymentsPayload.items : [];
  return items.map((payment) => ({
    id: `bsale_payment_${payment.id}`,
    externalPaymentId: String(payment.id || ""),
    externalDocumentId: String(payment?.document?.id || factura?.externalSync?.externalDocumentId || ""),
    empId: empId || factura?.empId || "",
    invoiceId: factura?.id || "",
    date: payment.recordDate
      ? new Date(Number(payment.recordDate) * 1000).toISOString().slice(0, 10)
      : "",
    amount: Number(payment.amount || payment.totalAmount || 0),
    method: payment?.payment_type?.name || payment?.paymentType?.name || "Pago Bsale",
    reference: payment?.reference || payment?.id || "",
    notes: payment?.detail || payment?.observation || "Sincronizado desde Bsale",
    source: "bsale",
    externalSync: {
      provider: "bsale",
      paymentId: String(payment.id || ""),
      paymentTypeId: String(payment?.payment_type?.id || ""),
      paymentTypeName: payment?.payment_type?.name || "",
    },
  }));
}

export function buildExternalSyncFromBsaleReturn(bsaleReturn = {}, creditNoteDocument = {}, previousSync = {}) {
  const externalSync = buildExternalSyncFromBsaleDocument(creditNoteDocument, previousSync);
  return {
    ...externalSync,
    externalReturnId: String(bsaleReturn?.id || previousSync?.externalReturnId || ""),
    returnCode: String(bsaleReturn?.code || ""),
    providerMessage: bsaleReturn?.motive || externalSync.providerMessage || "",
  };
}

export function buildExternalSyncFromBsaleAnnulment(bsaleAnnulment = {}, debitNoteDocument = {}, previousSync = {}) {
  const externalSync = buildExternalSyncFromBsaleDocument(debitNoteDocument, previousSync);
  return {
    ...externalSync,
    externalReturnId: String(previousSync?.externalReturnId || ""),
    externalAnnulmentId: String(bsaleAnnulment?.id || previousSync?.externalAnnulmentId || ""),
    providerMessage: debitNoteDocument?.responseMsgSii || previousSync?.providerMessage || "Nota de Débito generada por anulación de devolución",
  };
}
