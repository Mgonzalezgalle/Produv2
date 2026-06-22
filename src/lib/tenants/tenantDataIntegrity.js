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

function normalizeListValues(lists = {}) {
  if (!lists || typeof lists !== "object" || Array.isArray(lists)) return {};
  return Object.fromEntries(Object.entries(lists).map(([key, value]) => {
    if (!Array.isArray(value)) return [key, value];
    const normalized = Array.from(new Set(value.map(cleanText).filter(Boolean)));
    return [key, normalized];
  }));
}

function normalizeCrew(rows = [], empId = "", uid = defaultId) {
  return normalizeTenantRows(rows, empId, "crew", uid).map(item => ({
    ...item,
    nom: cleanText(item.nom || item.name || item.email) || "Colaborador sin nombre",
    rol: cleanText(item.rol || item.role || item.cargo || item.crewRole) || "Colaborador",
    area: cleanText(item.area || item.department) || "Operación",
    tipo: cleanText(item.tipo || item.kind) || "interno",
    ema: cleanText(item.ema || item.email),
    tel: cleanText(item.tel || item.phone),
    active: item.active !== false,
  }));
}

function normalizeContracts(rows = [], empId = "", providers = [], uid = defaultId) {
  return normalizeTenantRows(rows, empId, "contract", uid).map(item => {
    const provider = asArray(providers).find(row => (
      row.id === item.providerId
      || cleanText(row.name).toLowerCase() === cleanText(item.providerName || item.supplier).toLowerCase()
      || cleanText(row.razonSocial).toLowerCase() === cleanText(item.providerName || item.supplier).toLowerCase()
      || cleanText(row.rut).toLowerCase() === cleanText(item.providerRut || item.rut).toLowerCase()
    ));
    return {
      ...item,
      providerId: item.providerId || provider?.id || "",
      providerName: cleanText(item.providerName || item.supplier || provider?.name || provider?.razonSocial),
      mon: toNumber(item.mon),
      alertaDias: Number.isFinite(Number(item.alertaDias)) ? Number(item.alertaDias) : 30,
    };
  });
}

function normalizeAssets(rows = [], empId = "", crew = [], uid = defaultId) {
  return normalizeTenantRows(rows, empId, "asset", uid).map(item => {
    const personId = cleanText(item.assignedPersonId || item.personaId);
    const person = personId ? asArray(crew).find(row => row.id === personId) : null;
    return {
      ...item,
      nom: cleanText(item.nom || item.name) || "Activo sin nombre",
      categoria: cleanText(item.categoria || item.category) || "Otros",
      estado: cleanText(item.estado || item.status) || "Disponible",
      sucursal: cleanText(item.sucursal || item.branchName || item.location),
      valorCompra: toNumber(item.valorCompra || item.purchaseValue),
      assignedPersonId: personId,
      assignedPersonType: item.assignedPersonType || (person ? "crew" : ""),
      assignedPersonName: cleanText(item.assignedPersonName || item.personaNombre || person?.nom || person?.name),
      legacyProjectId: item.legacyProjectId || item.asignadoA || "",
      asignadoA: "",
      refTipo: "",
    };
  });
}

function normalizeEpisodes(rows = [], empId = "", uid = defaultId) {
  return normalizeTenantRows(rows, empId, "episode", uid).map(item => ({
    ...item,
    titulo: cleanText(item.titulo || item.title || item.nom) || "Episodio sin título",
    invitado: cleanText(item.invitado || item.guest),
    estado: cleanText(item.estado || item.status) || "Programado",
    grabacion: cleanText(item.grabacion || item.fechaGrabacion || item.fecha),
    emision: cleanText(item.emision || item.fechaEmision),
  }));
}

function countTenantRecordIssues(rows = [], empId = "", label = "registros") {
  return asArray(rows).reduce((issues, item, index) => {
    if (!item?.id) issues.push(`${label}: registro ${index + 1} sin ID.`);
    if (empId && item?.empId && item.empId !== empId) issues.push(`${label}: registro ${item.id || index + 1} pertenece a otra empresa.`);
    return issues;
  }, []);
}

function buildRelationIssueRows({
  rows = [],
  targetRows = [],
  directKey = "",
  targetLabel = "",
  rowLabel = "",
}) {
  const targetIds = new Set(asArray(targetRows).map(item => item.id).filter(Boolean));
  return asArray(rows).reduce((issues, item) => {
    const directValue = cleanText(item?.[directKey]);
    if (directValue && !targetIds.has(directValue)) {
      issues.push(`${rowLabel} ${cleanText(item.folio || item.reference || item.id) || "sin folio"} apunta a un ${targetLabel} inexistente.`);
      return issues;
    }
    if (!directValue) {
      const matched = matchByAnyValue(targetRows, [item.reference, item.folio, item.documentNumber, item.targetLabel]);
      if (!matched) issues.push(`${rowLabel} ${cleanText(item.folio || item.reference || item.id) || "sin folio"} no está asociado a un ${targetLabel}.`);
    }
    return issues;
  }, []);
}

export function buildTenantOperationalIntegrityReport({
  empId = "",
  collections = {},
} = {}) {
  const clientes = asArray(collections.clientes);
  const invoices = asArray(collections.facturas);
  const providers = asArray(collections.treasuryProviders);
  const payables = asArray(collections.treasuryPayables);
  const purchaseOrders = asArray(collections.treasuryPurchaseOrders);
  const receipts = asArray(collections.treasuryReceipts);
  const disbursements = asArray(collections.treasuryDisbursements);
  const budgets = asArray(collections.presupuestos);
  const content = asArray(collections.piezas);
  const contracts = asArray(collections.contratos);
  const crew = asArray(collections.crew);
  const assets = asArray(collections.activos);
  const episodes = asArray(collections.episodios);
  const programs = asArray(collections.programas);
  const lists = collections.listas && typeof collections.listas === "object" && !Array.isArray(collections.listas) ? collections.listas : {};

  const issues = [
    ...countTenantRecordIssues(clientes, empId, "Clientes"),
    ...countTenantRecordIssues(invoices, empId, "Facturación"),
    ...countTenantRecordIssues(providers, empId, "Proveedores"),
    ...countTenantRecordIssues(payables, empId, "Cuentas por pagar"),
    ...countTenantRecordIssues(purchaseOrders, empId, "Órdenes de compra"),
    ...countTenantRecordIssues(receipts, empId, "Pagos recibidos"),
    ...countTenantRecordIssues(disbursements, empId, "Pagos realizados"),
    ...countTenantRecordIssues(budgets, empId, "Presupuestos"),
    ...countTenantRecordIssues(content, empId, "Contenido"),
    ...countTenantRecordIssues(contracts, empId, "Contratos"),
    ...countTenantRecordIssues(crew, empId, "Colaboradores"),
    ...countTenantRecordIssues(assets, empId, "Activos"),
    ...countTenantRecordIssues(episodes, empId, "Episodios"),
    ...buildRelationIssueRows({
      rows: receipts,
      targetRows: invoices,
      directKey: "invoiceId",
      targetLabel: "documento emitido",
      rowLabel: "Pago recibido",
    }),
    ...buildRelationIssueRows({
      rows: disbursements,
      targetRows: payables,
      directKey: "payableId",
      targetLabel: "documento por pagar",
      rowLabel: "Pago realizado",
    }),
  ];

  const invoiceIds = new Set(invoices.map(item => item.id).filter(Boolean));
  purchaseOrders.forEach(order => {
    asArray(order.linkedInvoiceIds).forEach(invoiceId => {
      if (!invoiceIds.has(invoiceId)) {
        issues.push(`OC ${cleanText(order.number || order.folio || order.id) || "sin folio"} está vinculada a una factura inexistente.`);
      }
    });
  });

  payables.forEach(payable => {
    const hasProvider = payable.providerId && providers.some(provider => provider.id === payable.providerId);
    const supplierValues = [payable.supplier, payable.providerName, payable.rut].map(cleanText).filter(Boolean).map(value => value.toLowerCase());
    const matchedProvider = supplierValues.length && providers.some(provider => [
      provider.name,
      provider.razonSocial,
      provider.rut,
      provider.email,
    ].map(cleanText).filter(Boolean).map(value => value.toLowerCase()).some(value => supplierValues.includes(value)));
    if (providers.length && !hasProvider && !matchedProvider) {
      issues.push(`Documento por pagar ${cleanText(payable.folio || payable.documentNumber || payable.id) || "sin folio"} no está asociado a un proveedor válido.`);
    }
  });

  contracts.forEach(contract => {
    const providerValues = [
      contract.providerId,
      contract.providerName,
      contract.supplier,
      contract.providerRut,
      contract.rut,
    ].map(cleanText).filter(Boolean).map(value => value.toLowerCase());
    const hasProvider = providers.some(provider => [
      provider.id,
      provider.name,
      provider.razonSocial,
      provider.nom,
      provider.nombre,
      provider.rut,
    ].map(cleanText).filter(Boolean).map(value => value.toLowerCase()).some(value => providerValues.includes(value)));
    if (providers.length && !hasProvider) {
      issues.push(`Contrato ${cleanText(contract.nom || contract.id) || "sin nombre"} no está asociado a un proveedor válido.`);
    }
    if (!contract.providerId && contract.cliId) {
      issues.push(`Contrato ${cleanText(contract.nom || contract.id) || "sin nombre"} conserva una asociación histórica a cliente.`);
    }
  });

  const crewIds = new Set(crew.map(item => item.id).filter(Boolean));
  assets.forEach(asset => {
    if (!cleanText(asset.sucursal)) {
      issues.push(`Activo ${cleanText(asset.nom || asset.id) || "sin nombre"} no tiene sucursal asignada.`);
    }
    if (asset.assignedPersonId && !crewIds.has(asset.assignedPersonId) && asset.assignedPersonType !== "user") {
      issues.push(`Activo ${cleanText(asset.nom || asset.id) || "sin nombre"} apunta a un colaborador inexistente.`);
    }
    if (cleanText(asset.asignadoA) || cleanText(asset.refTipo)) {
      issues.push(`Activo ${cleanText(asset.nom || asset.id) || "sin nombre"} conserva una asociación antigua a trabajo.`);
    }
  });

  const programIds = new Set(programs.map(item => item.id).filter(Boolean));
  episodes.forEach(episode => {
    if (episode.pgId && !programIds.has(episode.pgId)) {
      issues.push(`Episodio ${cleanText(episode.titulo || episode.id) || "sin título"} apunta a una producción inexistente.`);
    }
  });

  Object.entries(lists).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    const cleaned = value.map(cleanText).filter(Boolean);
    if (cleaned.length !== value.length) issues.push(`Lista ${key} tiene valores vacíos.`);
    if (new Set(cleaned.map(item => item.toLowerCase())).size !== cleaned.length) issues.push(`Lista ${key} tiene valores duplicados.`);
  });

  const totalCollections = [
    clientes,
    invoices,
    providers,
    payables,
    purchaseOrders,
    receipts,
    disbursements,
    budgets,
    content,
    contracts,
    crew,
    assets,
    episodes,
  ].reduce((total, rows) => total + rows.length, 0);
  const relationCount = receipts.length + disbursements.length + purchaseOrders.reduce((total, order) => total + asArray(order.linkedInvoiceIds).length, 0);
  const cleanRelations = Math.max(0, relationCount - issues.length);
  const score = totalCollections === 0
    ? 0
    : Math.max(25, Math.min(100, 100 - issues.length * 10));
  const level = totalCollections === 0
    ? "empty"
    : issues.length === 0
      ? "ready"
      : issues.length <= 3
        ? "attention"
        : "risk";

  return {
    level,
    score,
    issueCount: issues.length,
    totalRecords: totalCollections,
    relationCount,
    cleanRelations,
    summary: totalCollections === 0
      ? "Sin datos operativos"
      : issues.length === 0
        ? "Operación consistente"
        : `${issues.length} punto${issues.length === 1 ? "" : "s"} por revisar`,
    metrics: {
      clientes: clientes.length,
      facturas: invoices.length,
      proveedores: providers.length,
      cuentasPorPagar: payables.length,
      ordenesCompra: purchaseOrders.length,
      pagosRecibidos: receipts.length,
      pagosRealizados: disbursements.length,
      presupuestos: budgets.length,
      contenidos: content.length,
      contratos: contracts.length,
      colaboradores: crew.length,
      activos: assets.length,
      episodios: episodes.length,
    },
    checks: [
      { id: "tenant_scope", label: "Datos dentro del tenant", ready: !issues.some(issue => issue.includes("otra empresa")) },
      { id: "payments_invoices", label: "Pagos recibidos asociados", ready: !issues.some(issue => issue.startsWith("Pago recibido")) },
      { id: "payments_payables", label: "Pagos realizados asociados", ready: !issues.some(issue => issue.startsWith("Pago realizado")) },
      { id: "purchase_orders", label: "OC vinculadas correctamente", ready: !issues.some(issue => issue.startsWith("OC ")) },
      { id: "providers", label: "Proveedores consistentes", ready: !issues.some(issue => issue.includes("proveedor válido")) },
      { id: "contracts", label: "Contratos asociados a proveedores", ready: !issues.some(issue => issue.startsWith("Contrato ")) },
      { id: "assets", label: "Activos con sucursal y responsable válido", ready: !issues.some(issue => issue.startsWith("Activo ")) },
      { id: "episodes", label: "Episodios vinculados correctamente", ready: !issues.some(issue => issue.startsWith("Episodio ")) },
      { id: "lists", label: "Listas por tenant limpias", ready: !issues.some(issue => issue.startsWith("Lista ")) },
    ],
    issues: issues.slice(0, 12),
  };
}

function comparableCollection(value) {
  return Array.isArray(value) || (value && typeof value === "object") ? value : [];
}

export function normalizeTenantOperationalSnapshot({
  empId = "",
  uid = defaultId,
  collections = {},
} = {}) {
  if (!empId) return { collections, changed: false };
  const listas = normalizeListValues(collections.listas);
  const providers = normalizeTenantRows(collections.treasuryProviders, empId, "provider", uid);
  const crew = normalizeCrew(collections.crew, empId, uid);
  const invoices = normalizeInvoices(collections.facturas, empId, uid);
  const payables = normalizePayables(collections.treasuryPayables, empId, providers, uid);
  const nextCollections = {
    listas,
    clientes: normalizeTenantRows(collections.clientes, empId, "client", uid),
    producciones: normalizeTenantRows(collections.producciones, empId, "project", uid),
    programas: normalizeTenantRows(collections.programas, empId, "program", uid),
    piezas: normalizeTenantRows(collections.piezas, empId, "content", uid),
    episodios: normalizeEpisodes(collections.episodios, empId, uid),
    auspiciadores: normalizeTenantRows(collections.auspiciadores, empId, "sponsor", uid),
    crmOpps: normalizeTenantRows(collections.crmOpps, empId, "crm", uid),
    crmActivities: normalizeTenantRows(collections.crmActivities, empId, "crm_activity", uid),
    crmStages: normalizeTenantRows(collections.crmStages, empId, "crm_stage", uid),
    contratos: normalizeContracts(collections.contratos, empId, providers, uid),
    movimientos: normalizeTenantRows(collections.movimientos, empId, "mov", uid),
    crew,
    eventos: normalizeTenantRows(collections.eventos, empId, "event", uid),
    tareas: normalizeTenantRows(collections.tareas, empId, "task", uid),
    presupuestos: normalizeTenantRows(collections.presupuestos, empId, "budget", uid),
    facturas: invoices,
    treasuryProviders: providers,
    treasuryPayables: payables,
    treasuryPurchaseOrders: normalizePurchaseOrders(collections.treasuryPurchaseOrders, empId, invoices, uid),
    treasuryIssuedOrders: normalizeTenantRows(collections.treasuryIssuedOrders, empId, "issued_po", uid),
    treasuryReceipts: normalizeReceipts(collections.treasuryReceipts, empId, invoices, uid),
    treasuryDisbursements: normalizeDisbursements(collections.treasuryDisbursements, empId, payables, uid),
    activos: normalizeAssets(collections.activos, empId, crew, uid),
  };
  return {
    collections: nextCollections,
    changed: Object.keys(nextCollections).some(key => (
      JSON.stringify(nextCollections[key]) !== JSON.stringify(comparableCollection(collections[key]))
    )),
  };
}
