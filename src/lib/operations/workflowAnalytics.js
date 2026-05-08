function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function countRecords(registry = null) {
  return Array.isArray(registry?.records) ? registry.records.length : 0;
}

export function buildFinancialWorkflowAnalytics({
  invoices = [],
  receipts = [],
  disbursements = [],
  payables = [],
  purchaseOrders = [],
  issuedOrders = [],
  remoteFinancialRegistries = {},
} = {}) {
  const localInvoices = asArray(invoices);
  const localReceipts = asArray(receipts);
  const localDisbursements = asArray(disbursements);
  const localPayables = asArray(payables);
  const localPurchaseOrders = asArray(purchaseOrders);
  const localIssuedOrders = asArray(issuedOrders);

  const invoiceIdsWithReceipts = new Set(localReceipts.map(item => String(item?.invoiceId || "").trim()).filter(Boolean));
  const payableIdsWithDisbursements = new Set(localDisbursements.map(item => String(item?.payableId || "").trim()).filter(Boolean));

  const invoicesPendingCollection = localInvoices.filter(item => Number(item?.total || 0) > 0 && !invoiceIdsWithReceipts.has(String(item?.id || "").trim())).length;
  const purchaseOrdersWithoutInvoice = localPurchaseOrders.filter(item => !asArray(item?.linkedInvoiceIds).length).length;
  const purchaseOrdersPartiallyMatched = localPurchaseOrders.filter(item => {
    const amount = Number(item?.amount || 0);
    const linkedInvoiceIds = asArray(item?.linkedInvoiceIds);
    return linkedInvoiceIds.length > 0 && amount > 0;
  }).length;
  const payablesPendingPayment = localPayables.filter(item => !payableIdsWithDisbursements.has(String(item?.id || "").trim())).length;
  const payablesOverdue = localPayables.filter(item => String(item?.dueDate || "") && String(item.dueDate) < new Date().toISOString().slice(0, 10) && !payableIdsWithDisbursements.has(String(item?.id || "").trim())).length;
  const issuedOrdersWithoutItems = localIssuedOrders.filter(item => !asArray(item?.items).length).length;
  const issuedOrdersWithoutSupplier = localIssuedOrders.filter(item => !String(item?.supplier || "").trim()).length;

  const coverage = {
    invoices: localInvoices.length === 0 ? 1 : Math.min(1, countRecords(remoteFinancialRegistries?.invoices) / Math.max(localInvoices.length, 1)),
    receipts: localReceipts.length === 0 ? 1 : Math.min(1, countRecords(remoteFinancialRegistries?.receipts) / Math.max(localReceipts.length, 1)),
    disbursements: localDisbursements.length === 0 ? 1 : Math.min(1, countRecords(remoteFinancialRegistries?.disbursements) / Math.max(localDisbursements.length, 1)),
    payables: localPayables.length === 0 ? 1 : Math.min(1, countRecords(remoteFinancialRegistries?.payables) / Math.max(localPayables.length, 1)),
    purchaseOrders: localPurchaseOrders.length === 0 ? 1 : Math.min(1, countRecords(remoteFinancialRegistries?.purchase_orders) / Math.max(localPurchaseOrders.length, 1)),
    issuedOrders: localIssuedOrders.length === 0 ? 1 : Math.min(1, countRecords(remoteFinancialRegistries?.issued_orders) / Math.max(localIssuedOrders.length, 1)),
  };

  const coverageScore = Math.round(
    ((coverage.invoices + coverage.receipts + coverage.disbursements + coverage.payables + coverage.purchaseOrders + coverage.issuedOrders) / 6) * 100,
  );

  const warnings = [
    invoicesPendingCollection > 0 ? `Hay ${invoicesPendingCollection} factura(s) sin receipts asociados todavía.` : "",
    purchaseOrdersWithoutInvoice > 0 ? `Hay ${purchaseOrdersWithoutInvoice} orden(es) de compra sin factura asociada.` : "",
    payablesPendingPayment > 0 ? `Hay ${payablesPendingPayment} cuenta(s) por pagar sin disbursement asociado.` : "",
    payablesOverdue > 0 ? `Hay ${payablesOverdue} cuenta(s) por pagar vencidas sin pago aplicado.` : "",
    issuedOrdersWithoutItems > 0 ? `Hay ${issuedOrdersWithoutItems} OC emitida(s) sin detalle económico estructurado.` : "",
    issuedOrdersWithoutSupplier > 0 ? `Hay ${issuedOrdersWithoutSupplier} OC emitida(s) sin proveedor definido.` : "",
    coverageScore < 100 ? `La cobertura foundation del workflow financiero está en ${coverageScore}%.` : "",
  ].filter(Boolean);

  return {
    invoicesPendingCollection,
    purchaseOrdersWithoutInvoice,
    purchaseOrdersPartiallyMatched,
    payablesPendingPayment,
    payablesOverdue,
    issuedOrdersWithoutItems,
    issuedOrdersWithoutSupplier,
    coverage,
    coverageScore,
    warningCount: warnings.length,
    warnings,
  };
}
