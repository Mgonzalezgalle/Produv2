import { cobranzaState, invoiceEntityName, today } from "./helpers";

export const TREASURY_MODULE_ID = "tesoreria";
export const TREASURY_MODULE_LABEL = "Tesorería";
export const TREASURY_MODULE_ICON = "🏦";
export const TREASURY_STORE_KEYS = [
  "treasuryProviders",
  "treasuryPayables",
  "treasuryPurchaseOrders",
  "treasuryIssuedOrders",
  "treasuryReceipts",
  "treasuryDisbursements",
];

export function treasuryReleaseEnabled() {
  try {
    const configured = String(import.meta.env?.VITE_ENABLE_TREASURY || "").trim().toLowerCase();
    if (!configured) return true;
    return configured === "true";
  } catch {
    return true;
  }
}

export function buildTreasurySidebarItem(count = 0) {
  return {
    id: TREASURY_MODULE_ID,
    icon: TREASURY_MODULE_ICON,
    label: TREASURY_MODULE_LABEL,
    need: TREASURY_MODULE_ID,
    cnt: Number(count || 0),
  };
}

export function buildSeedTreasuryData(empId = "") {
  return {
    treasuryProviders: empId === "emp1" ? [
      {
        id: "tpv1",
        empId,
        name: "Arriendos Providencia",
        razonSocial: "Arriendos Providencia Ltda.",
        rut: "77.123.450-2",
        direccion: "Providencia 1250, Santiago",
        tipoProveedor: "Arriendo",
        contactos: [
          { id: "tpv1c1", nombre: "Carolina Pérez", cargo: "Ejecutiva comercial", email: "carolina@arriendosprov.cl", telefono: "+56 9 8123 1111" },
        ],
        bankAccounts: [
          { id: "tpv1b1", banco: "Banco de Chile", titular: "Arriendos Providencia Ltda.", rut: "77.123.450-2", tipoCuenta: "Corriente", numeroCuenta: "0012458701", emailPago: "pagos@arriendosprov.cl" },
        ],
      },
      {
        id: "tpv2",
        empId,
        name: "Servicios Post Uno",
        razonSocial: "Servicios Post Uno SpA",
        rut: "76.889.221-4",
        direccion: "Avenida Matta 988, Santiago",
        tipoProveedor: "Postproducción",
        contactos: [
          { id: "tpv2c1", nombre: "Javier Muñoz", cargo: "Productor ejecutivo", email: "javier@spu.cl", telefono: "+56 9 7444 2211" },
          { id: "tpv2c2", nombre: "Andrea León", cargo: "Cobranza", email: "cobranza@spu.cl", telefono: "+56 2 2555 8899" },
        ],
        bankAccounts: [
          { id: "tpv2b1", banco: "Santander", titular: "Servicios Post Uno SpA", rut: "76.889.221-4", tipoCuenta: "Corriente", numeroCuenta: "55420098", emailPago: "finanzas@spu.cl" },
        ],
      },
    ] : [],
    treasuryPayables: empId === "emp1" ? [
      { id: "tp1", empId, supplier: "Arriendos Providencia", folio: "ARR-204", category: "Arriendo", issueDate: "2026-04-01", dueDate: "2026-04-12", total: 450000, paid: 0, status: "Pendiente", pdfName: "arriendo-abril.pdf", pdfUrl: "", notes: "Oficina comercial abril" },
      { id: "tp2", empId, supplier: "Servicios Post Uno", folio: "SPU-882", category: "Servicio", issueDate: "2026-03-20", dueDate: "2026-04-02", total: 720000, paid: 220000, status: "Parcial", pdfName: "post-marzo.pdf", pdfUrl: "", notes: "Saldo pendiente edición final" },
    ] : [],
    treasuryPurchaseOrders: empId === "emp1" ? [
      { id: "po1", empId, clientId: "c1", number: "OC-BS-2026-14", issueDate: "2026-04-02", amount: 4200000, linkedInvoiceIds: [], pdfName: "oc-bancoseguro.pdf", pdfUrl: "", notes: "Campaña invierno 2026" },
      { id: "po2", empId, clientId: "c3", number: "OC-EF-2026-03", issueDate: "2026-03-28", amount: 1800000, linkedInvoiceIds: [], pdfName: "oc-edufutura.pdf", pdfUrl: "", notes: "Servicio contenido mensual" },
    ] : [],
    treasuryIssuedOrders: empId === "emp1" ? [
      { id: "io1", empId, supplier: "Arriendos Providencia", number: "OC-AP-2026-05", issueDate: "2026-04-05", amount: 450000, pdfName: "oc-arriendo.pdf", pdfUrl: "", notes: "Arriendo abril" },
      { id: "io2", empId, supplier: "Servicios Post Uno", number: "OC-SPU-2026-02", issueDate: "2026-03-18", amount: 720000, pdfName: "oc-post.pdf", pdfUrl: "", notes: "Edición y postproducción" },
    ] : [],
    treasuryReceipts: empId === "emp1" ? [
      { id: "tr1", empId, invoiceId: "", date: "2026-04-04", amount: 350000, method: "Transferencia", reference: "ABN-9921", notes: "Pago parcial inicial" },
    ] : [],
    treasuryDisbursements: empId === "emp1" ? [
      { id: "td1", empId, payableId: "tp2", date: "2026-04-03", amount: 220000, method: "Transferencia", reference: "SANT-5542", notes: "Abono parcial postproducción" },
    ] : [],
  };
}

export function countPendingTreasury(facturas = [], empId = "") {
  return (Array.isArray(facturas) ? facturas : [])
    .filter(item => item?.empId === empId && cobranzaState(item) !== "Pagado")
    .length;
}

function normalizePayments(payments = [], empId = "", targetKey = "", targetId = "") {
  return (Array.isArray(payments) ? payments : [])
    .filter(item => item?.empId === empId && item?.[targetKey] === targetId)
    .map(item => ({
      ...item,
      amount: Number(item.amount || 0),
    }))
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function receivableBucket(doc = {}) {
  const dueDate = doc.fechaVencimiento || "";
  if (!dueDate) return "Sin vencimiento";
  const state = cobranzaState(doc);
  if (state === "Pagado") return "Pagado";
  if (dueDate < today()) return "Vencido";
  return "Por vencer";
}

function clientCreditLimit(client = {}) {
  return Number(
    client?.creditLimit
    ?? client?.limiteCredito
    ?? client?.limCred
    ?? 0
  ) || 0;
}

export function buildTreasuryReceivables({ facturas = [], clientes = [], auspiciadores = [], receipts = [], empId = "" } = {}) {
  return (Array.isArray(facturas) ? facturas : [])
    .filter(doc => doc?.empId === empId)
    .map(doc => {
      const total = Number(doc?.total || 0);
      const state = cobranzaState(doc);
      const paymentHistory = normalizePayments(receipts, empId, "invoiceId", doc.id);
      const manualPaid = paymentHistory.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const paid = state === "Pagado" ? total : Math.min(total, manualPaid);
      const pending = Math.max(0, total - paid);
      const cobranza = pending <= 0 ? "Pagado" : state;
      const entityName = invoiceEntityName(doc, clientes, auspiciadores);
      const bucket = pending <= 0 ? "Pagado" : (state === "Pagado" ? "Pagado" : receivableBucket(doc));
      return {
        id: doc.id,
        correlativo: doc.correlativo || doc.tipoDoc || "Sin correlativo",
        tipoDoc: doc.tipoDoc || "Invoice",
        entidadId: doc.entidadId || "",
        entidadTipo: doc.tipo || "cliente",
        entidad: entityName,
        total,
        pending,
        paid,
        estado: doc.estado || "Emitida",
        cobranza,
        bucket,
        fechaEmision: doc.fecha || doc.fechaEmision || "",
        fechaVencimiento: doc.fechaVencimiento || "",
        source: doc.origen || doc.tipoRef || "",
        paymentHistory,
      };
    })
    .sort((a, b) => {
      const dueA = String(a.fechaVencimiento || "9999-99-99");
      const dueB = String(b.fechaVencimiento || "9999-99-99");
      if (dueA !== dueB) return dueA.localeCompare(dueB);
      return String(a.correlativo || "").localeCompare(String(b.correlativo || ""));
    });
}

export function summarizeTreasuryReceivables(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const total = list.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const pending = list.reduce((sum, row) => sum + Number(row.pending || 0), 0);
  const paid = list.reduce((sum, row) => sum + Number(row.paid || 0), 0);
  const overdue = list
    .filter(row => row.bucket === "Vencido")
    .reduce((sum, row) => sum + Number(row.pending || 0), 0);
  return {
    total,
    pending,
    paid,
    overdue,
    docs: list.length,
    overdueDocs: list.filter(row => row.bucket === "Vencido").length,
  };
}

export function buildTreasuryPortfolio({ rows = [], clientes = [], purchaseOrders = [] } = {}) {
  const clients = Array.isArray(clientes) ? clientes : [];
  const byEntity = new Map();
  (Array.isArray(rows) ? rows : []).forEach(row => {
    const current = byEntity.get(row.entidadId) || {
      entidadId: row.entidadId,
      entidad: row.entidad,
      tipo: row.entidadTipo,
      total: 0,
      pending: 0,
      paid: 0,
      overdue: 0,
      docs: 0,
      creditLimit: 0,
      documents: [],
      purchaseOrders: [],
    };
    current.total += Number(row.total || 0);
    current.pending += Number(row.pending || 0);
    current.paid += Number(row.paid || 0);
    current.docs += 1;
    if (row.bucket === "Vencido") current.overdue += Number(row.pending || 0);
    current.documents.push(row);
    byEntity.set(row.entidadId, current);
  });
  return Array.from(byEntity.values())
    .map(entry => {
      const client = clients.find(item => item.id === entry.entidadId);
      const creditLimit = clientCreditLimit(client);
      const clientOrders = (Array.isArray(purchaseOrders) ? purchaseOrders : []).filter(order => order.clientId === entry.entidadId);
      const totalPendingPortfolio = (Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + Number(row.pending || 0), 0);
      return {
        ...entry,
        creditLimit,
        availableCredit: creditLimit ? creditLimit - entry.pending : null,
        purchaseOrders: clientOrders,
        concentrationPct: totalPendingPortfolio > 0 ? (entry.pending / totalPendingPortfolio) * 100 : 0,
      };
    })
    .sort((a, b) => Number(b.pending || 0) - Number(a.pending || 0));
}

export function summarizeTreasuryPayables(movimientos = [], empId = "") {
  const expenses = (Array.isArray(movimientos) ? movimientos : [])
    .filter(item => item?.empId === empId && item?.tipo === "gasto");
  return {
    docs: expenses.length,
    total: expenses.reduce((sum, item) => sum + Number(item.mon || 0), 0),
  };
}

export function buildTreasuryPayables({ payables = [], disbursements = [], empId = "" } = {}) {
  return (Array.isArray(payables) ? payables : [])
    .filter(item => item?.empId === empId)
    .map(item => {
      const total = Number(item.total || 0);
      const paymentHistory = normalizePayments(disbursements, empId, "payableId", item.id);
      const paid = paymentHistory.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const pending = Math.max(0, total - paid);
      const dueDate = item.dueDate || "";
      const status = pending <= 0 ? "Pagada" : (paid > 0 ? "Parcial" : (dueDate && dueDate < today() ? "Vencida" : "Pendiente"));
      return {
        ...item,
        total,
        paid,
        pending,
        status,
        paymentHistory,
      };
    })
    .sort((a, b) => String(a.dueDate || "9999-99-99").localeCompare(String(b.dueDate || "9999-99-99")));
}

export function summarizeStoredPayables(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    docs: list.length,
    total: list.reduce((sum, item) => sum + Number(item.total || 0), 0),
    paid: list.reduce((sum, item) => sum + Number(item.paid || 0), 0),
    pending: list.reduce((sum, item) => sum + Number(item.pending || 0), 0),
    overdue: list.filter(item => item.status === "Vencida").reduce((sum, item) => sum + Number(item.pending || 0), 0),
  };
}

export function buildTreasuryPurchaseOrders({ orders = [], facturas = [], clientes = [], receipts = [], empId = "" } = {}) {
  const invoices = Array.isArray(facturas) ? facturas : [];
  return (Array.isArray(orders) ? orders : [])
    .filter(item => item?.empId === empId)
    .map(item => {
      const amount = Number(item.amount || 0);
      const linkedInvoiceIds = Array.isArray(item.linkedInvoiceIds) ? item.linkedInvoiceIds : [];
      const linkedInvoices = invoices.filter(doc => linkedInvoiceIds.includes(doc.id));
      const linkedInvoicesDetailed = linkedInvoices.map(doc => {
        const paymentHistory = normalizePayments(receipts, empId, "invoiceId", doc.id);
        const paid = paymentHistory.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const total = Number(doc.total || 0);
        const pending = Math.max(0, total - paid);
        const cobranza = pending <= 0 ? "Pagado" : cobranzaState(doc);
        return {
          id: doc.id,
          correlativo: doc.correlativo || doc.tipoDoc || "Documento",
          total,
          paid,
          pending,
          cobranza,
          fecha: doc.fecha || doc.fechaEmision || "",
          fechaVencimiento: doc.fechaVencimiento || "",
          paymentHistory,
        };
      });
      const matchedAmount = linkedInvoices.reduce((sum, doc) => sum + Number(doc.total || 0), 0);
      const pendingAmount = Math.max(0, amount - matchedAmount);
      const invoicesPaid = linkedInvoicesDetailed.reduce((sum, doc) => sum + Number(doc.paid || 0), 0);
      const invoicesPending = linkedInvoicesDetailed.reduce((sum, doc) => sum + Number(doc.pending || 0), 0);
      const client = (Array.isArray(clientes) ? clientes : []).find(entry => entry.id === item.clientId);
      return {
        ...item,
        amount,
        clientName: client?.nom || item.clientName || "Cliente no encontrado",
        linkedInvoiceIds,
        linkedInvoices: linkedInvoicesDetailed,
        matchedAmount,
        pendingAmount,
        invoicesPaid,
        invoicesPending,
        billingStatus: linkedInvoicesDetailed.length
          ? linkedInvoicesDetailed.every(doc => doc.cobranza === "Pagado")
            ? "Facturado y pagado"
            : linkedInvoicesDetailed.some(doc => doc.paid > 0)
              ? "Facturado parcial"
              : "Facturado pendiente"
          : "Sin facturar",
        status: pendingAmount <= 0 ? "Conciliada" : linkedInvoices.length ? "Parcial" : "Pendiente",
      };
    })
    .sort((a, b) => String(a.issueDate || "9999-99-99").localeCompare(String(b.issueDate || "9999-99-99")));
}

export function summarizePurchaseOrders(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    docs: list.length,
    total: list.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    matched: list.reduce((sum, item) => sum + Number(item.matchedAmount || 0), 0),
    pending: list.reduce((sum, item) => sum + Number(item.pendingAmount || 0), 0),
  };
}

export function buildTreasuryIssuedOrders({ orders = [], empId = "" } = {}) {
  return (Array.isArray(orders) ? orders : [])
    .filter(item => item?.empId === empId)
    .map(item => ({
      ...item,
      amount: Number(item.amount || 0),
    }))
    .sort((a, b) => String(a.issueDate || "9999-99-99").localeCompare(String(b.issueDate || "9999-99-99")));
}

export function summarizeIssuedOrders(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  return {
    docs: list.length,
    total: list.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  };
}

export function buildTreasuryReceiptLog({ receipts = [], facturas = [], empId = "" } = {}) {
  const docs = Array.isArray(facturas) ? facturas : [];
  return (Array.isArray(receipts) ? receipts : [])
    .filter(item => item?.empId === empId)
    .map(item => {
      const invoice = docs.find(doc => doc.id === item.invoiceId);
      return {
        ...item,
        amount: Number(item.amount || 0),
        targetLabel: invoice?.correlativo || invoice?.tipoDoc || item.reference || "Documento",
      };
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export function buildTreasuryDisbursementLog({ disbursements = [], payables = [], empId = "" } = {}) {
  const docs = Array.isArray(payables) ? payables : [];
  return (Array.isArray(disbursements) ? disbursements : [])
    .filter(item => item?.empId === empId)
    .map(item => {
      const payable = docs.find(doc => doc.id === item.payableId);
      return {
        ...item,
        amount: Number(item.amount || 0),
        targetLabel: payable?.folio || payable?.supplier || item.reference || "Cuenta por pagar",
      };
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function emptyArray(value) {
  return Array.isArray(value) ? value : [];
}

export function buildTreasuryProviders({ providers = [], payables = [], issuedOrders = [], empId = "" } = {}) {
  const map = new Map();
  const ensure = (name = "", provider = null, createIfMissing = true) => {
    const key = String(name || provider?.name || provider?.razonSocial || "Proveedor sin nombre").trim() || "Proveedor sin nombre";
    if (!map.has(key)) {
      if (!createIfMissing) return null;
      map.set(key, {
        id: provider?.id || key,
        empId,
        name: provider?.name || key,
        razonSocial: provider?.razonSocial || "",
        rut: provider?.rut || "",
        direccion: provider?.direccion || "",
        tipoProveedor: provider?.tipoProveedor || "",
        contactos: emptyArray(provider?.contactos),
        bankAccounts: emptyArray(provider?.bankAccounts),
        payables: [],
        issuedOrders: [],
        totalDebt: 0,
        paid: 0,
        pending: 0,
      });
    } else if (provider) {
      const current = map.get(key);
      map.set(key, {
        ...current,
        ...provider,
        name: provider?.name || current.name,
        razonSocial: provider?.razonSocial || current.razonSocial,
        rut: provider?.rut || current.rut,
        direccion: provider?.direccion || current.direccion,
        tipoProveedor: provider?.tipoProveedor || current.tipoProveedor,
        contactos: emptyArray(provider?.contactos).length ? emptyArray(provider?.contactos) : current.contactos,
        bankAccounts: emptyArray(provider?.bankAccounts).length ? emptyArray(provider?.bankAccounts) : current.bankAccounts,
      });
    }
    return map.get(key);
  };

  emptyArray(providers)
    .filter(item => item?.empId === empId)
    .forEach(item => ensure(item.name || item.razonSocial, item));

  emptyArray(payables)
    .filter(item => item?.empId === empId)
    .forEach(item => {
      const entry = ensure(item.supplier, null, false);
      if (!entry) return;
      entry.payables.push(item);
      entry.totalDebt += Number(item.total || 0);
      entry.paid += Number(item.paid || 0);
      entry.pending += Number(item.pending || 0);
    });

  emptyArray(issuedOrders)
    .filter(item => item?.empId === empId)
    .forEach(item => {
      const entry = ensure(item.supplier, null, false);
      if (!entry) return;
      entry.issuedOrders.push(item);
    });

  return Array.from(map.values()).sort((a, b) => Number(b.pending || 0) - Number(a.pending || 0) || String(a.name || "").localeCompare(String(b.name || "")));
}
