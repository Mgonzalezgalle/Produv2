function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value = "") {
  return String(value || "").trim();
}

function toNumber(value = 0) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function defaultId(prefix = "row") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function ensureTenantRecord(item = {}, empId = "", prefix = "row", uid = defaultId) {
  return {
    ...item,
    id: cleanText(item.id) || (typeof uid === "function" ? uid() : defaultId(prefix)),
    empId,
  };
}

function uniqueById(rows = []) {
  const byId = new Map();
  asArray(rows).forEach(item => {
    if (!item?.id) return;
    byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
  });
  return Array.from(byId.values());
}

function normalizeTenantRows(rows = [], empId = "", prefix = "row", uid = defaultId) {
  if (!empId) return asArray(rows);
  return uniqueById(asArray(rows).map(item => ensureTenantRecord(item, empId, prefix, uid)));
}

function matchByAnyValue(rows = [], values = []) {
  const normalizedValues = new Set(values.map(cleanText).filter(Boolean).map(value => value.toLowerCase()));
  if (!normalizedValues.size) return null;
  return asArray(rows).find(row => {
    const candidates = [
      row.id,
      row.folio,
      row.number,
      row.documentNumber,
      row.correlativo,
      row.externalSync?.number,
      row.externalSync?.externalDocumentId,
    ].map(cleanText).filter(Boolean).map(value => value.toLowerCase());
    return candidates.some(value => normalizedValues.has(value));
  }) || null;
}

function normalizeInvoices(rows = [], empId = "", uid = defaultId) {
  return normalizeTenantRows(rows, empId, "fact", uid).map(item => ({
    ...item,
    total: toNumber(item.total),
    montoNeto: toNumber(item.montoNeto),
    ivaVal: toNumber(item.ivaVal),
    cobranzaEstado: cleanText(item.cobranzaEstado || item.cobro || item.status) || "Pendiente de pago",
  }));
}

function normalizePayables(rows = [], empId = "", providers = [], uid = defaultId) {
  return normalizeTenantRows(rows, empId, "pay", uid).map(item => {
    const provider = asArray(providers).find(row => row.id === item.providerId || cleanText(row.name).toLowerCase() === cleanText(item.supplier).toLowerCase());
    return {
      ...item,
      providerId: item.providerId || provider?.id || "",
      supplier: cleanText(item.supplier || provider?.name || provider?.razonSocial),
      total: toNumber(item.total),
      currency: item.currency || provider?.currency || "CLP",
    };
  });
}

function normalizePurchaseOrders(rows = [], empId = "", invoices = [], uid = defaultId) {
  const invoiceIds = new Set(asArray(invoices).map(item => item.id).filter(Boolean));
  return normalizeTenantRows(rows, empId, "po", uid).map(item => ({
    ...item,
    amount: toNumber(item.amount),
    linkedInvoiceIds: asArray(item.linkedInvoiceIds).filter(id => invoiceIds.has(id)),
  }));
}

function normalizeReceipts(rows = [], empId = "", invoices = [], uid = defaultId) {
  return normalizeTenantRows(rows, empId, "rec", uid).map(item => {
    const invoice = item.invoiceId ? null : matchByAnyValue(invoices, [item.reference, item.folio, item.documentNumber, item.targetLabel]);
    return {
      ...item,
      invoiceId: item.invoiceId || invoice?.id || "",
      amount: toNumber(item.amount || item.monto),
    };
  });
}

function normalizeDisbursements(rows = [], empId = "", payables = [], uid = defaultId) {
  return normalizeTenantRows(rows, empId, "disb", uid).map(item => {
    const payable = item.payableId ? null : matchByAnyValue(payables, [item.reference, item.folio, item.documentNumber, item.targetLabel]);
    return {
      ...item,
      payableId: item.payableId || payable?.id || "",
      amount: toNumber(item.amount || item.monto),
      currency: item.currency || payable?.currency || "CLP",
    };
  });
}

export function normalizeTenantOperationalSnapshot({
  empId = "",
  uid = defaultId,
  collections = {},
} = {}) {
  if (!empId) return { collections, changed: false };
  const providers = normalizeTenantRows(collections.treasuryProviders, empId, "provider", uid);
  const invoices = normalizeInvoices(collections.facturas, empId, uid);
  const payables = normalizePayables(collections.treasuryPayables, empId, providers, uid);
  const nextCollections = {
    clientes: normalizeTenantRows(collections.clientes, empId, "client", uid),
    producciones: normalizeTenantRows(collections.producciones, empId, "project", uid),
    programas: normalizeTenantRows(collections.programas, empId, "program", uid),
    piezas: normalizeTenantRows(collections.piezas, empId, "content", uid),
    auspiciadores: normalizeTenantRows(collections.auspiciadores, empId, "sponsor", uid),
    presupuestos: normalizeTenantRows(collections.presupuestos, empId, "budget", uid),
    facturas: invoices,
    treasuryProviders: providers,
    treasuryPayables: payables,
    treasuryPurchaseOrders: normalizePurchaseOrders(collections.treasuryPurchaseOrders, empId, invoices, uid),
    treasuryIssuedOrders: normalizeTenantRows(collections.treasuryIssuedOrders, empId, "issued_po", uid),
    treasuryReceipts: normalizeReceipts(collections.treasuryReceipts, empId, invoices, uid),
    treasuryDisbursements: normalizeDisbursements(collections.treasuryDisbursements, empId, payables, uid),
  };
  return {
    collections: nextCollections,
    changed: Object.keys(nextCollections).some(key => (
      JSON.stringify(nextCollections[key]) !== JSON.stringify(asArray(collections[key]))
    )),
  };
}
