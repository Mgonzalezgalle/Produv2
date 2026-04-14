export const PRODU_BILLING_ACTION_MODE = {
  MANUAL: "manual",
  AUTOMATIC: "automatic",
};

export const PRODU_BILLING_DOCUMENT_TYPES = [
  {
    code: "factura_afecta",
    label: "Factura Afecta",
    family: "tributario",
    taxable: true,
    requiresExternalProvider: true,
    bsaleDocumentTypeCode: "invoice_taxed",
    codeSii: 33,
  },
  {
    code: "factura_exenta",
    label: "Factura Exenta",
    family: "tributario",
    taxable: false,
    requiresExternalProvider: true,
    bsaleDocumentTypeCode: "invoice_exempt",
    codeSii: 34,
  },
  {
    code: "boleta_afecta",
    label: "Boleta Afecta",
    family: "tributario",
    taxable: true,
    requiresExternalProvider: true,
    bsaleDocumentTypeCode: "receipt_taxed",
    codeSii: 39,
  },
  {
    code: "boleta_exenta",
    label: "Boleta Exenta",
    family: "tributario",
    taxable: false,
    requiresExternalProvider: true,
    bsaleDocumentTypeCode: "receipt_exempt",
    codeSii: 41,
  },
  {
    code: "nota_credito",
    label: "Nota de Crédito",
    family: "tributario",
    taxable: false,
    requiresExternalProvider: true,
    bsaleDocumentTypeCode: "credit_note",
    codeSii: 61,
  },
  {
    code: "nota_debito",
    label: "Nota de Débito",
    family: "tributario",
    taxable: false,
    requiresExternalProvider: true,
    bsaleDocumentTypeCode: "debit_note",
    codeSii: 56,
  },
  {
    code: "guia_despacho",
    label: "Guía de Despacho",
    family: "tributario",
    taxable: false,
    requiresExternalProvider: true,
    bsaleDocumentTypeCode: "dispatch_note",
    codeSii: 52,
  },
  {
    code: "orden_factura",
    label: "Orden de Factura",
    family: "comercial",
    taxable: false,
    requiresExternalProvider: false,
    bsaleDocumentTypeCode: null,
  },
  {
    code: "invoice",
    label: "Invoice",
    family: "comercial",
    taxable: false,
    requiresExternalProvider: false,
    bsaleDocumentTypeCode: null,
  },
];

export const PRODU_BILLING_REFERENCE_CODES = [
  { value: "", label: "Sin referencia", codeSii: null, family: "none" },
  { value: "801", label: "Orden de Compra", codeSii: 801, family: "commercial" },
  { value: "802", label: "Nota de Pedido", codeSii: 802, family: "commercial" },
  { value: "803", label: "Contrato", codeSii: 803, family: "commercial" },
  { value: "804", label: "Resolución", codeSii: 804, family: "administrative" },
  { value: "805", label: "Proceso ChileCompra", codeSii: 805, family: "administrative" },
  { value: "806", label: "Ficha ChileCompra", codeSii: 806, family: "administrative" },
  { value: "document", label: "Documento tributario", codeSii: null, family: "document" },
];

export function getProduBillingDocumentTypes() {
  return PRODU_BILLING_DOCUMENT_TYPES.slice();
}

export function getProduBillingReferenceCodeOptions() {
  return PRODU_BILLING_REFERENCE_CODES.slice();
}

export function getProduBillingReferenceCode(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return PRODU_BILLING_REFERENCE_CODES.find((item) => String(item.value || "").trim().toLowerCase() === normalized) || null;
}

export function getProduBillingReferenceCodeLabel(value = "") {
  return getProduBillingReferenceCode(value)?.label || "Referencia";
}

export function getProduBillingDocumentType(code) {
  const normalizedCode = String(code || "").trim().toLowerCase();
  return PRODU_BILLING_DOCUMENT_TYPES.find((item) => item.code === normalizedCode) || null;
}

export function resolveProduBillingDocumentType(value = "") {
  const rawType = String(value || "").trim().toLowerCase();
  const legacyMap = {
    factura: "factura_afecta",
    "factura afecta": "factura_afecta",
    "factura exenta": "factura_exenta",
    boleta: "boleta_afecta",
    "boleta afecta": "boleta_afecta",
    "boleta exenta": "boleta_exenta",
    invoice: "invoice",
    "orden de factura": "orden_factura",
    orden_factura: "orden_factura",
  };
  return getProduBillingDocumentType(legacyMap[rawType] || rawType || "factura_afecta");
}

export function getProduBillingDocumentTypeOptions() {
  return PRODU_BILLING_DOCUMENT_TYPES.map((item) => ({
    value: item.label,
    label: item.label,
    code: item.code,
    family: item.family,
    requiresExternalProvider: item.requiresExternalProvider,
    taxable: item.taxable,
  }));
}

export function getProduBillingDocumentTypeLabel(value = "") {
  return resolveProduBillingDocumentType(value)?.label || "Factura Afecta";
}

export function getProduBillingDocumentCodeSii(value = "") {
  return Number(resolveProduBillingDocumentType(value)?.codeSii || 0) || null;
}

export function isProduRecurringDocument(value = "") {
  return resolveProduBillingDocumentType(value)?.code === "invoice";
}

export function supportsProduDocumentVat(value = "") {
  return resolveProduBillingDocumentType(value)?.taxable === true;
}

export function supportsProduDocumentHonorarios(value = "") {
  return resolveProduBillingDocumentType(value)?.code === "orden_factura";
}

export function getProduBillingFinancialMultiplier(value = "") {
  const code = resolveProduBillingDocumentType(value)?.code;
  if (code === "nota_credito") return -1;
  return 1;
}

export function requiresProduCollectionTracking(value = "") {
  const code = resolveProduBillingDocumentType(value)?.code;
  return ["factura_afecta", "factura_exenta", "boleta_afecta", "boleta_exenta", "invoice", "nota_debito"].includes(code);
}

export function shouldProduBillingDocumentAppearInTreasury(value = "") {
  const code = resolveProduBillingDocumentType(value)?.code;
  return [
    "factura_afecta",
    "factura_exenta",
    "boleta_afecta",
    "boleta_exenta",
    "invoice",
    "nota_credito",
    "nota_debito",
    "orden_factura",
  ].includes(code);
}

export function isProduBillingDocumentIssued(document = {}) {
  const estado = String(document?.estado || "").trim().toLowerCase();
  return estado !== "borrador" && estado !== "anulada";
}

export function requiresProduBillingReferences(value = "") {
  const code = resolveProduBillingDocumentType(value)?.code;
  return ["nota_credito", "nota_debito", "guia_despacho"].includes(code);
}

export function canProduBillingDocumentBeReferenced(value = "") {
  const code = resolveProduBillingDocumentType(value)?.code;
  return [
    "factura_afecta",
    "factura_exenta",
    "boleta_afecta",
    "boleta_exenta",
    "nota_debito",
    "guia_despacho",
  ].includes(code);
}

export function getProduBillingReferenceReasonOptions(value = "") {
  const code = resolveProduBillingDocumentType(value)?.code;
  if (code === "nota_credito") {
    return [
      "Anula documento de referencia",
      "Corrige monto del documento",
      "Corrige detalle del documento",
      "Descuento posterior",
    ];
  }
  if (code === "nota_debito") {
    return [
      "Recargo posterior",
      "Ajuste de monto",
      "Intereses o diferencias",
      "Corrección del documento",
    ];
  }
  if (code === "guia_despacho") {
    return [
      "Traslado de mercadería",
      "Despacho asociado a venta",
      "Entrega parcial",
      "Muestra o traslado interno",
    ];
  }
  return ["Documento relacionado"];
}

export function getDefaultProduBillingReferenceReason(value = "") {
  return getProduBillingReferenceReasonOptions(value)[0] || "Documento relacionado";
}

export function buildProduBillingReferenceSummary(factura = {}) {
  if (factura.referenceCodeSii && factura.referenceCodeSii !== "document") {
    const referenceLabel = getProduBillingReferenceCodeLabel(factura.referenceCodeSii);
    const referenceNumber = String(
      factura.relatedDocumentFolio
      || factura.referenceNumber
      || factura.referenciaNumero
      || ""
    ).trim();
    const reason = String(factura.relatedDocumentReason || "").trim();
    if (!referenceNumber && !reason) return "";
    if (!referenceNumber) return `${referenceLabel}${reason ? ` · ${reason}` : ""}`;
    return `${referenceLabel} · ${referenceNumber}${reason ? ` · ${reason}` : ""}`;
  }
  const type = resolveProduBillingDocumentType(
    factura.documentTypeCode || factura.tipoDocumento || factura.tipoDoc,
  );
  if (!requiresProduBillingReferences(type?.code)) return "";

  const referenceNumber = String(
    factura.relatedDocumentFolio
    || factura.referenceNumber
    || factura.referenciaNumero
    || factura.relatedDocumentId
    || "",
  ).trim();
  const reason = String(
    factura.relatedDocumentReason || getDefaultProduBillingReferenceReason(type?.code),
  ).trim();
  const relatedTypeLabel = factura.relatedDocumentTypeCode
    ? getProduBillingDocumentTypeLabel(factura.relatedDocumentTypeCode)
    : "Documento relacionado";

  if (!referenceNumber && !reason) return "";
  if (!referenceNumber) return `${relatedTypeLabel} · ${reason}`;
  return `${relatedTypeLabel} · ${referenceNumber}${reason ? ` · ${reason}` : ""}`;
}

export function validateProduBillingReferencePayload(factura = {}) {
  if (factura.referenceCodeSii && factura.referenceCodeSii !== "document") {
    const referenceNumber = String(
      factura.relatedDocumentFolio
      || factura.referenceNumber
      || factura.referenciaNumero
      || ""
    ).trim();
    if (!referenceNumber) {
      return {
        ok: false,
        reason: "Debes indicar el valor de la referencia tributaria antes de emitir.",
      };
    }
    return { ok: true, reason: "" };
  }
  const type = resolveProduBillingDocumentType(
    factura.documentTypeCode || factura.tipoDocumento || factura.tipoDoc,
  );
  if (!requiresProduBillingReferences(type?.code)) {
    return { ok: true, reason: "" };
  }

  const referenceNumber = String(
    factura.relatedDocumentFolio
    || factura.referenceNumber
    || factura.referenciaNumero
    || factura.relatedDocumentId
    || "",
  ).trim();
  const referenceReason = String(factura.relatedDocumentReason || "").trim();

  if (!referenceNumber) {
    return {
      ok: false,
      reason: "Debes indicar el documento origen o al menos su folio antes de emitir.",
    };
  }

  if (!referenceReason) {
    return {
      ok: false,
      reason: "Debes indicar el motivo de referencia para emitir este documento.",
    };
  }

  if (factura.relatedDocumentTypeCode && !canProduBillingDocumentBeReferenced(factura.relatedDocumentTypeCode)) {
    return {
      ok: false,
      reason: "El documento origen seleccionado no es válido como referencia tributaria.",
    };
  }

  return { ok: true, reason: "" };
}

export function evaluateProduBillingBsaleReadiness(value = "") {
  const isObjectInput = value && typeof value === "object" && !Array.isArray(value);
  const factura = isObjectInput ? value : null;
  const type = resolveProduBillingDocumentType(
    factura
      ? (factura.documentTypeCode || factura.tipoDocumento || factura.tipoDoc)
      : value,
  );
  if (!type?.requiresExternalProvider) {
    return {
      status: "not_applicable",
      label: "No aplica Bsale",
      reason: "Documento comercial interno",
    };
  }

  if (["factura_afecta", "factura_exenta", "boleta_afecta", "boleta_exenta"].includes(type.code)) {
    return {
      status: "ready",
      label: "Listo para emitir",
      reason: "Cobertura Bsale operativa en sandbox",
    };
  }

  if (["nota_credito", "nota_debito", "guia_despacho"].includes(type.code)) {
    const referenceValidation = validateProduBillingReferencePayload(factura || {});
    return {
      status: referenceValidation.ok ? "ready" : "pending_references",
      label: referenceValidation.ok ? "Listo para emitir" : "Pendiente de referencias",
      reason: referenceValidation.ok
        ? "Referencia tributaria mínima cargada"
        : referenceValidation.reason,
    };
  }

  return {
    status: "review",
    label: "Requiere revisión",
    reason: "Tipo documental aún no validado end-to-end",
  };
}

export function buildProduBillingContract() {
  return {
    providerStrategy: "external_electronic_invoicing_provider",
    activationMode: PRODU_BILLING_ACTION_MODE.MANUAL,
    supportedDocuments: getProduBillingDocumentTypes(),
    requiredRecipientFields: [
      "nombre",
      "rut",
      "direccion",
      "comuna",
      "ciudad",
      "giro",
      "email",
    ],
    requiredInvoiceFields: [
      "tipoDocumento",
      "fechaEmision",
      "lineItems",
      "neto",
      "iva",
      "total",
    ],
  };
}
