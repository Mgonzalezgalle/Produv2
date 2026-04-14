import { getProduBillingDocumentType, resolveProduBillingDocumentType } from "./billingDomain";
import { buildBsaleInvoiceRequest, resolveBsaleDocumentTypeIdFromCatalog } from "./bsaleBilling";

export const BSALE_DOCUMENT_TYPE_IDS = {
  invoice_taxed: 33,
  invoice_exempt: 34,
  receipt_taxed: 39,
  receipt_exempt: 41,
  credit_note: 61,
  debit_note: 56,
  dispatch_note: 52,
};

function normalizeProduDocumentType(factura = {}) {
  return resolveProduBillingDocumentType(
    factura.documentTypeCode
    || factura.tipoDocumento
    || factura.tipoDoc,
  )?.code || "factura_afecta";
}

export function resolveBsaleDocumentTypeId(factura = {}, fallbackDocumentTypeId = "") {
  const produType = getProduBillingDocumentType(normalizeProduDocumentType(factura));
  const mappedId = produType?.bsaleDocumentTypeCode
    ? BSALE_DOCUMENT_TYPE_IDS[produType.bsaleDocumentTypeCode]
    : null;

  return mappedId || (fallbackDocumentTypeId ? Number(fallbackDocumentTypeId) : undefined);
}

export function mapProduInvoiceToBsale({
  factura = {},
  empresa = {},
  cliente = {},
  lineItems = [],
  references = [],
  config,
  documentTypesCatalog = null,
} = {}) {
  const produType = getProduBillingDocumentType(normalizeProduDocumentType(factura));
  const documentTypeId = documentTypesCatalog
    ? resolveBsaleDocumentTypeIdFromCatalog(produType?.code || normalizeProduDocumentType(factura), documentTypesCatalog, config?.documentTypeId)
    : resolveBsaleDocumentTypeId(factura, config?.documentTypeId);
  const payload = buildBsaleInvoiceRequest({
    factura: {
      ...factura,
      documentTypeCode: produType?.code || normalizeProduDocumentType(factura),
    },
    empresa,
    cliente,
    lineItems,
    references,
    config: {
      ...config,
      documentTypeId,
    },
  });

  return {
    produType,
    documentTypeId,
    payload,
  };
}

export function buildBsaleInvoiceSyncDraft({
  factura = {},
  empresa = {},
  cliente = {},
  lineItems = [],
  references = [],
  config,
  documentTypesCatalog = null,
} = {}) {
  const mapped = mapProduInvoiceToBsale({
    factura,
    empresa,
    cliente,
    lineItems,
    references,
    config,
    documentTypesCatalog,
  });

  return {
    provider: "bsale",
    mode: "manual",
    sourceInvoiceId: factura?.id || "",
    sourceCompanyId: empresa?.id || factura?.empId || "",
    sourceDocumentType: mapped.produType?.code || "",
    request: mapped.payload,
    createdAt: new Date().toISOString(),
  };
}
