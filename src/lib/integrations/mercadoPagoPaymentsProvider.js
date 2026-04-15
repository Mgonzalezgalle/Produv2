import { getMercadoPagoPaymentsConfig, getMercadoPagoPaymentsProviderSnapshot, resolveMercadoPagoCurrency } from "./mercadoPagoPaymentsConfig";

export const MERCADOPAGO_PAYMENT_TEMPLATE = {
  INVOICE_LINK: "invoice_payment_link",
};

export const MERCADOPAGO_PAYMENT_STATUS = {
  DRAFT: "draft",
  ACTIVE: "active",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  CHARGED_BACK: "charged_back",
};

function buildReference({ invoice = {}, tenantId = "" } = {}) {
  const invoiceId = String(invoice.id || invoice.invoiceId || "").trim();
  const safeTenant = String(tenantId || invoice.empId || "").trim();
  return invoiceId ? `tenant:${safeTenant}:invoice:${invoiceId}` : "";
}

export function buildMercadoPagoInvoicePaymentDraft({
  invoice = {},
  empresa = {},
  customer = {},
  currentUser = {},
  expiresAt = "",
} = {}) {
  const config = getMercadoPagoPaymentsConfig();
  const tenantId = String(empresa?.id || invoice?.empId || "").trim();
  const amount = Number((invoice?.saldoPendiente ?? invoice?.pending ?? invoice?.montoPendiente ?? invoice?.total) || 0);
  const currency = resolveMercadoPagoCurrency(invoice?.moneda || empresa?.billingCurrency || "", config.marketplace);
  const entityName = String(customer?.razonSocial || customer?.nombre || invoice?.entidad || "").trim();
  const documentNumber = String(invoice?.correlativo || invoice?.folio || invoice?.numero || "Documento").trim();
  return {
    provider: "mercadopago",
    config: getMercadoPagoPaymentsProviderSnapshot(),
    tenantId,
    userId: String(currentUser?.id || "").trim(),
    userEmail: String(currentUser?.email || "").trim(),
    templateKey: MERCADOPAGO_PAYMENT_TEMPLATE.INVOICE_LINK,
    paymentType: "invoice_payment_link",
    paymentStatus: MERCADOPAGO_PAYMENT_STATUS.DRAFT,
    invoiceId: String(invoice?.id || "").trim(),
    invoiceNumber: documentNumber,
    externalReference: buildReference({ invoice, tenantId }),
    customer: {
      id: String(customer?.id || invoice?.entidadId || "").trim(),
      name: entityName,
      email: String(customer?.email || customer?.ema || "").trim(),
    },
    issuer: {
      tenantName: String(empresa?.nombre || "").trim(),
      tenantEmail: String(empresa?.ema || "").trim(),
    },
    amount,
    currency,
    title: `Pago factura ${documentNumber}`.trim(),
    description: `Pago directo de la factura ${documentNumber} emitida por ${String(empresa?.nombre || "Produ").trim()}`.trim(),
    expiresAt: String(expiresAt || "").trim(),
    metadata: {
      tenantId,
      invoiceId: String(invoice?.id || "").trim(),
      invoiceNumber: documentNumber,
      customerId: String(customer?.id || invoice?.entidadId || "").trim(),
      customerName: entityName,
    },
    ready: config.ready && !!tenantId && !!documentNumber && amount > 0,
  };
}

export function validateMercadoPagoInvoicePaymentDraft(draft = {}) {
  const errors = [];
  if (!draft?.tenantId) errors.push("Falta tenantId.");
  if (!draft?.invoiceId) errors.push("Falta invoiceId.");
  if (!draft?.invoiceNumber) errors.push("Falta folio o correlativo.");
  if (!(Number(draft?.amount || 0) > 0)) errors.push("Falta monto válido para generar el link.");
  if (!draft?.currency) errors.push("Falta moneda.");
  if (!draft?.externalReference) errors.push("Falta externalReference.");
  return {
    ok: errors.length === 0,
    errors,
  };
}

export function buildMercadoPagoPreferenceRequest(draft = {}) {
  const validation = validateMercadoPagoInvoicePaymentDraft(draft);
  if (!validation.ok) {
    return {
      ok: false,
      validation,
      error: "No pudimos preparar la preferencia de pago.",
    };
  }

  return {
    ok: true,
    provider: "mercadopago",
    requestType: "invoice_payment_link",
    tenantId: draft.tenantId,
    invoiceId: draft.invoiceId,
    externalReference: draft.externalReference,
    payload: {
      items: [
        {
          id: draft.invoiceId,
          title: draft.title,
          description: draft.description,
          quantity: 1,
          currency_id: draft.currency,
          unit_price: Number(draft.amount || 0),
        },
      ],
      payer: {
        email: draft.customer?.email || undefined,
      },
      external_reference: draft.externalReference,
      metadata: draft.metadata,
      expires: !!draft.expiresAt,
      expiration_date_to: draft.expiresAt || undefined,
    },
  };
}
