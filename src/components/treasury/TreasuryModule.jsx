import React, { useMemo, useState } from "react";
import {
  Badge,
  Empty,
  FilterSel,
  FI,
  FSl,
  GBtn,
  ModuleHeader,
  Paginator,
  TD,
  TH,
} from "../../lib/ui/components";
import { fmtD, fmtM, fmtMonthPeriod, openWhatsApp, today, uid } from "../../lib/utils/helpers";
import { useLabTreasuryModule } from "../../hooks/useLabTreasuryModule";
import { useLabBillingTools } from "../../hooks/useLabBillingTools";
import { resolveTransactionalEmailTemplate } from "../../lib/integrations/transactionalEmailTemplates";
import { TreasuryIssuedOrderModal } from "./TreasuryIssuedOrderModal";
import { ProvidersPanel } from "./TreasuryDetails";
import { IssuedOrderDetailModal, PortfolioDetailModal, ProviderDetailModal } from "./TreasuryDetailModals";
import { TreasuryPayableModal } from "./TreasuryPayableModal";
import { TreasuryPaymentModal } from "./TreasuryPaymentModal";
import { TreasuryPurchaseOrderModal } from "./TreasuryPurchaseOrderModal";
import { TreasuryPayablesSection, TreasuryReceivablesSection } from "./TreasurySections";
import { TreasuryBulkImporterModal } from "./TreasuryBulkImporterModal";
import { TreasuryStyles, SectionCard, useTableState } from "./TreasuryCore";
import { TransactionalEmailComposerModal } from "../shared/TransactionalEmailComposerModal";
import { ConfirmActionDialog } from "../shared/ConfirmActionDialog";
import { buildIssuedOrderPdfDataUrl, buildIssuedOrderPdfFile } from "../../lib/utils/treasuryIssuedOrderPdf";
import { formatTreasuryMoney, normalizeTreasuryCurrency, TREASURY_CURRENCIES } from "../../lib/utils/treasury";
import { appendOperationalAuditEntry } from "../../lib/operations/operationalAudit";

function normalizeImportLookupValue(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeRutLookup(value = "") {
  return String(value || "").replace(/[^0-9kK]/g, "").toLowerCase();
}

function findClientForImport(clients = [], row = {}) {
  const wantedRut = normalizeRutLookup(row.clientRut || row.rut);
  const wantedName = normalizeImportLookupValue(row.clientName || row.name);
  return (clients || []).find(client => {
    const rutMatch = wantedRut && normalizeRutLookup(client?.rut) === wantedRut;
    const nameMatch = wantedName && normalizeImportLookupValue(client?.nom || client?.name || client?.razonSocial) === wantedName;
    return rutMatch || nameMatch;
  }) || null;
}

function findProviderForImport(providers = [], row = {}) {
  const wantedRut = normalizeRutLookup(row.providerRut || row.rut);
  const wantedName = normalizeImportLookupValue(row.providerName || row.name);
  return (providers || []).find(provider => {
    const rutMatch = wantedRut && normalizeRutLookup(provider?.rut) === wantedRut;
    const nameMatch = wantedName && normalizeImportLookupValue(provider?.name || provider?.razonSocial) === wantedName;
    return rutMatch || nameMatch;
  }) || null;
}

function findPayableDocForImport(rows = [], row = {}) {
  const wantedFolio = normalizeImportLookupValue(row.folio);
  const wantedRut = normalizeRutLookup(row.providerRut);
  const wantedProvider = normalizeImportLookupValue(row.providerName);
  return (rows || []).find(doc => {
    const folioMatch = wantedFolio && normalizeImportLookupValue(doc?.folio || doc?.number) === wantedFolio;
    const rutMatch = !wantedRut || normalizeRutLookup(doc?.rut || doc?.providerRut) === wantedRut;
    const providerMatch = !wantedProvider || normalizeImportLookupValue(doc?.supplier || doc?.providerName) === wantedProvider;
    return folioMatch && (rutMatch || providerMatch);
  }) || null;
}

function TreasurySurfaceMetric({ label, value, tone = "var(--cy)", hint = null, wide = false }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : "auto", padding: "14px 15px", borderRadius: 16, border: "1px solid var(--bdr2)", background: "linear-gradient(180deg,rgba(255,255,255,.78),rgba(241,245,249,.9))", boxShadow: "0 10px 24px rgba(148,163,184,.12)" }}>
      <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: tone, lineHeight: 1 }}>{value}</div>
      {!!hint && <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.45, marginTop: 8 }}>{hint}</div>}
    </div>
  );
}

function summarizeMovementLog(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const currencies = TREASURY_CURRENCIES
    .map(currency => {
      const currencyRows = list.filter(item => normalizeTreasuryCurrency(item?.currency) === currency);
      return {
        currency,
        docs: currencyRows.length,
        total: currencyRows.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
      };
    })
    .filter(item => item.docs > 0);
  const primary = currencies.find(item => item.currency === "CLP") || { currency: "CLP", docs: 0, total: 0 };
  return {
    docs: list.length,
    total: primary.total,
    currency: "CLP",
    currencies,
    otherCurrencies: currencies.filter(item => item.currency !== "CLP"),
  };
}

async function openPdfSourceInNewTab(src = "", fallbackName = "documento.pdf") {
  const trimmedSrc = String(src || "").trim();
  if (!trimmedSrc) return false;
  if (/^https?:\/\//i.test(trimmedSrc)) {
    window.open(trimmedSrc, "_blank", "noopener,noreferrer");
    return true;
  }
  const response = await fetch(trimmedSrc);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return true;
}

function escapeEmailHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function TreasuryModule(props) {
  const [payablesTab, setPayablesTab] = useState("documentos");
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioItem, setPortfolioItem] = useState(null);
  const [issuedDetailOpen, setIssuedDetailOpen] = useState(false);
  const [issuedDetailItem, setIssuedDetailItem] = useState(null);
  const [receiptClientFilter, setReceiptClientFilter] = useState("");
  const [receiptPeriodFilter, setReceiptPeriodFilter] = useState("");
  const [payableSupplierFilter, setPayableSupplierFilter] = useState("");
  const [payablePeriodFilter, setPayablePeriodFilter] = useState("");
  const [issuedSupplierFilter, setIssuedSupplierFilter] = useState("");
  const [disbursementSupplierFilter, setDisbursementSupplierFilter] = useState("");
  const [disbursementPeriodFilter, setDisbursementPeriodFilter] = useState("");
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailComposerDraft, setEmailComposerDraft] = useState(null);
  const [emailComposerSending, setEmailComposerSending] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(null);
  const [importerMode, setImporterMode] = useState(null);
  const [importingTreasury, setImportingTreasury] = useState(false);
  const openPortfolioDetail = item => { setPortfolioItem(item); setPortfolioOpen(true); };
  const openIssuedOrderDetail = React.useCallback(item => {
    setIssuedDetailItem(item);
    setIssuedDetailOpen(true);
  }, []);
  const closeIssuedOrderDetail = React.useCallback(() => {
    setIssuedDetailOpen(false);
    setIssuedDetailItem(null);
  }, []);
  const {
    tab, setTab, filteredReceivables, receivableSummary, portfolio,
    providers, payables, payablesSummary, purchaseOrders, purchaseOrderSummary, issuedOrders, issuedOrderSummary,
    receiptLog, disbursementLog, canManageTreasury, payableOpen, payableDraft, poOpen, poDraft, issuedOpen, issuedDraft,
    receiptOpen, receiptDraft, disbursementOpen, disbursementDraft, providerOpen, providerDraft, savePayable, deletePayable,
    savePurchaseOrder, deletePurchaseOrder, saveIssuedOrder, deleteIssuedOrder, saveReceipt, saveDisbursement,
    saveProvider, deleteProvider, openPayableCreate, openPayableEdit, openPurchaseOrderCreate, openPurchaseOrderEdit, openIssuedOrderCreate,
    openIssuedOrderEdit, openReceiptCreate, openDisbursementCreate, openReceiptEdit, openDisbursementEdit, openProviderCreate, openProviderEdit,
    deleteReceipt, deleteDisbursement, closePayable, closePurchaseOrder, closeIssuedOrder, closeReceipt, closeDisbursement, closeProvider,
  } = useLabTreasuryModule({
    ...props,
    currentUser: props.user || null,
    platformServices: props.platformServices || null,
  });
  const { clientes = [], facturas = [] } = props;
  const saveFacturaDoc = props.saveFacturaDoc;
  const openTreasuryImporter = React.useCallback(mode => setImporterMode(mode), []);
  const closeTreasuryImporter = React.useCallback(() => {
    if (!importingTreasury) setImporterMode(null);
  }, [importingTreasury]);
  const {
    createBillingEmailDraft,
    createPaymentLinkEmailDraft,
    createStatementEmailDraft,
    generateMercadoPagoPaymentLink,
    refreshMercadoPagoPaymentStatus,
    simulateMercadoPagoPayment,
    deliverEmailDraft,
    sendBillingWhatsApp,
    sendPaymentLinkWhatsApp,
    sendStatementWhatsApp,
  } = useLabBillingTools({
    allDocs: (facturas || []).filter(item => item.empId === props.empresa?.id),
    movimientos: props.movimientos || [],
    setFacturas: props.setFacturas || (() => {}),
    saveFacturaDoc,
    setMovimientos: props.setMovimientos || (() => {}),
    canEdit: canManageTreasury,
    ntf: props.ntf,
    empresa: props.empresa,
    clientes: props.clientes || [],
    auspiciadores: props.auspiciadores || [],
    invoiceEntityName: (doc, clientesArg, auspiciadoresArg) => {
      const entity = doc.tipo === "auspiciador"
        ? (auspiciadoresArg || []).find(item => item.id === doc.entidadId)
        : (clientesArg || []).find(item => item.id === doc.entidadId);
      return entity?.nom || "—";
    },
    cobranzaState: doc => doc.cobranzaEstado || "Pendiente de pago",
    fmtD,
    fmtM,
    fmtMonthPeriod: value => value,
    today: () => new Date().toISOString().slice(0,10),
    addMonths: (date, months) => {
      const base = new Date(`${date}T12:00:00`);
      base.setMonth(base.getMonth() + Number(months || 0));
      return base.toISOString().slice(0,10);
    },
    uid: () => `treasury_${Math.random().toString(36).slice(2,10)}`,
    platformApi: props.platformApi,
    senderReplyTo: props.user?.email || "",
    treasuryReceipts: props.treasury?.receipts || [],
    setTreasuryReceipts: props.treasury?.setReceipts || null,
  });
  const openEmailComposer = React.useCallback((builderResult) => {
    if (!builderResult?.ok || !builderResult?.draft) {
      window.alert(builderResult?.message || "No pudimos preparar el correo.");
      return;
    }
    setEmailComposerDraft(builderResult.draft);
    setEmailComposerOpen(true);
  }, []);
  const closeEmailComposer = React.useCallback(() => {
    if (emailComposerSending) return;
    setEmailComposerOpen(false);
    setEmailComposerDraft(null);
  }, [emailComposerSending]);
  const handleSendComposedEmail = React.useCallback(async (draft) => {
    setEmailComposerSending(true);
    try {
      const result = await deliverEmailDraft(draft);
      if (!result?.ok) {
        window.alert(result?.message || "No pudimos enviar el correo.");
        return;
      }
      if (draft?.entityType === "issued_purchase_order" && draft?.entityId) {
        const current = (issuedOrders || []).find(item => item.id === draft.entityId);
        if (current) {
          await saveIssuedOrder({
            ...current,
            lastSentAt: new Date().toISOString(),
            lastSentTo: String(draft?.to || "").trim(),
            lastSentSubject: String(draft?.subject || "").trim(),
            lastSentSource: result?.source || "remote",
          });
        }
      }
      setEmailComposerOpen(false);
      setEmailComposerDraft(null);
    } finally {
      setEmailComposerSending(false);
    }
  }, [deliverEmailDraft, issuedOrders, saveIssuedOrder]);
  const openBillingEmailComposer = React.useCallback((doc, entity) => {
    openEmailComposer(createBillingEmailDraft(doc, entity));
  }, [createBillingEmailDraft, openEmailComposer]);
  const openPaymentLinkEmailComposer = React.useCallback((doc, entity) => {
    openEmailComposer(createPaymentLinkEmailDraft(doc, entity));
  }, [createPaymentLinkEmailDraft, openEmailComposer]);
  const openStatementEmailComposer = React.useCallback((docs, entity, type) => {
    openEmailComposer(createStatementEmailDraft(docs, entity, type));
  }, [createStatementEmailDraft, openEmailComposer]);
  const receivableTable = useTableState(filteredReceivables, {
    searchFields: [row => row.correlativo, row => row.entidad],
    statusOptions: ["Pendiente de pago", "Retrasado de pago", "Pagado", "Anulado", "Por vencer", "Vencido", "Ajuste crédito"],
    getStatus: row => row.bucket === "Vencido" ? "Vencido" : row.cobranza,
    isSelectable: row => row?.allowsManualReceipts !== false || row?.collectionEditable !== false,
  });
  const portfolioTable = useTableState(portfolio, { searchFields: [row => row.entidad], getId: row => row.entidadId, pageSize: 6 });
  const poTable = useTableState(purchaseOrders, { searchFields: [row => row.clientName, row => row.number], statusOptions: ["Pendiente", "Facturada", "Completada", "Sin facturar", "Facturado parcial", "Facturado y pagado"], getStatus: row => row.billingStatus, pageSize: 6 });
  const filteredReceiptLog = useMemo(
    () => receiptLog.filter(row => {
      const rowPeriod = String(row.date || "").slice(0, 7);
      const matchesClient = !receiptClientFilter || row.counterpartyLabel === receiptClientFilter;
      const matchesPeriod = !receiptPeriodFilter || rowPeriod === receiptPeriodFilter;
      return matchesClient && matchesPeriod;
    }),
    [receiptLog, receiptClientFilter, receiptPeriodFilter],
  );
  const receiptClientOptions = useMemo(
    () => Array.from(new Set(receiptLog.map(row => row.counterpartyLabel).filter(Boolean).filter(label => label !== "—"))).sort((a, b) => a.localeCompare(b)),
    [receiptLog],
  );
  const receiptPeriodOptions = useMemo(
    () => Array.from(new Set(receiptLog.map(row => String(row.date || "").slice(0, 7)).filter(Boolean))).sort().reverse().map(period => ({ value: period, label: fmtMonthPeriod(`${period}-01`) })),
    [receiptLog],
  );
  const receiptsSummary = useMemo(() => summarizeMovementLog(receiptLog), [receiptLog]);
  const receiptTable = useTableState(filteredReceiptLog, { searchFields: [row => row.targetLabel, row => row.counterpartyLabel, row => row.reference, row => row.method], pageSize: 6 });
  const filteredPayables = useMemo(
    () => payables.filter(row => {
      const rowPeriod = String(row.issueDate || row.dueDate || "").slice(0, 7);
      const matchesSupplier = !payableSupplierFilter || row.supplier === payableSupplierFilter;
      const matchesPeriod = !payablePeriodFilter || rowPeriod === payablePeriodFilter;
      return matchesSupplier && matchesPeriod;
    }),
    [payables, payableSupplierFilter, payablePeriodFilter],
  );
  const payableSupplierOptions = useMemo(
    () => Array.from(new Set(payables.map(row => row.supplier).filter(Boolean).filter(label => label !== "—"))).sort((a, b) => a.localeCompare(b)),
    [payables],
  );
  const payablePeriodOptions = useMemo(
    () => Array.from(new Set(payables.map(row => String(row.issueDate || row.dueDate || "").slice(0, 7)).filter(Boolean))).sort().reverse().map(period => ({ value: period, label: fmtMonthPeriod(`${period}-01`) })),
    [payables],
  );
  const payableTable = useTableState(filteredPayables, { searchFields: [row => row.supplier, row => row.folio], statusOptions: ["Pendiente", "Parcial", "Pagada", "Vencida", "Anulada"], getStatus: row => row.status, pageSize: 6 });
  const filteredIssuedOrders = useMemo(
    () => issuedOrders.filter(row => !issuedSupplierFilter || row.supplier === issuedSupplierFilter),
    [issuedOrders, issuedSupplierFilter],
  );
  const issuedSupplierOptions = useMemo(
    () => Array.from(new Set(issuedOrders.map(row => row.supplier).filter(Boolean).filter(label => label !== "—"))).sort((a, b) => a.localeCompare(b)),
    [issuedOrders],
  );
  const issuedTable = useTableState(filteredIssuedOrders, { searchFields: [row => row.supplier, row => row.number], pageSize: 6 });
  const filteredDisbursementLog = useMemo(
    () => disbursementLog.filter(row => {
      const rowPeriod = String(row.date || "").slice(0, 7);
      const matchesSupplier = !disbursementSupplierFilter || row.counterpartyLabel === disbursementSupplierFilter;
      const matchesPeriod = !disbursementPeriodFilter || rowPeriod === disbursementPeriodFilter;
      return matchesSupplier && matchesPeriod;
    }),
    [disbursementLog, disbursementSupplierFilter, disbursementPeriodFilter],
  );
  const disbursementSupplierOptions = useMemo(
    () => Array.from(new Set(disbursementLog.map(row => row.counterpartyLabel).filter(Boolean).filter(label => label !== "—"))).sort((a, b) => a.localeCompare(b)),
    [disbursementLog],
  );
  const disbursementPeriodOptions = useMemo(
    () => Array.from(new Set(disbursementLog.map(row => String(row.date || "").slice(0, 7)).filter(Boolean))).sort().reverse().map(period => ({ value: period, label: fmtMonthPeriod(`${period}-01`) })),
    [disbursementLog],
  );
  const disbursementSummary = useMemo(() => summarizeMovementLog(disbursementLog), [disbursementLog]);
  const disbursementTable = useTableState(filteredDisbursementLog, { searchFields: [row => row.targetLabel, row => row.counterpartyLabel, row => row.reference, row => row.method], pageSize: 6 });
  const providerTable = useTableState(providers, { searchFields: [row => row.name, row => row.razonSocial, row => row.rut], pageSize: 6 });
  const providerPaymentRows = useMemo(() => {
    if (!providerDraft?.name) return [];
    return (disbursementLog || []).filter(row => row.counterpartyLabel === providerDraft.name);
  }, [disbursementLog, providerDraft?.name]);
  const handlePayableUpdate = async (row, patch = {}) => {
    if (!canManageTreasury || !row?.id) return;
    const source = (payables || []).find(item => item.id === row.id) || row;
    await savePayable({ ...source, ...patch });
  };
  const handleReceivableStatusUpdate = React.useCallback(async (row, nextState) => {
    if (!canManageTreasury || !saveFacturaDoc || !row?.id) return false;
    const currentDoc = (facturas || []).find(doc => doc.id === row.id) || row;
    const previousStatus = String(currentDoc?.cobranzaEstado || row?.cobranza || "").trim();
    const resolvedNextState = String(nextState || "").trim();
    if (!resolvedNextState) return false;
    const nextDoc = {
      ...currentDoc,
      cobranzaEstado: resolvedNextState,
      fechaPago:
        resolvedNextState === "Pagado"
          ? (currentDoc?.fechaPago || new Date().toISOString().slice(0, 10))
          : "",
    };
    const saved = await saveFacturaDoc(nextDoc);
    if (previousStatus !== resolvedNextState) {
      await appendOperationalAuditEntry({
        empId: props.empresa?.id || currentDoc?.empId || "",
        area: "tesoreria",
        action: "receivable_status_changed",
        entityType: "treasury_receivable",
        entityId: row.id || "",
        actor: props.user || null,
        payload: {
          documentNumber: row?.correlativo || currentDoc?.correlativo || currentDoc?.folio || "",
          counterparty: row?.entidad || "",
          source: row?.source || currentDoc?.tipo || "facturacion",
          previousStatus,
          nextStatus: resolvedNextState,
          total: Number(row?.total || currentDoc?.total || 0),
          pending: Number(row?.pending || 0),
          previousPaymentDate: currentDoc?.fechaPago || "",
          nextPaymentDate: nextDoc.fechaPago || "",
          sensitive: ["Pagado", "Anulado"].includes(resolvedNextState),
        },
        platformServices: props.platformServices || null,
      });
    }
    return saved;
  }, [canManageTreasury, facturas, props.empresa?.id, props.platformServices, props.user, saveFacturaDoc]);
  const buildSupplierEmailDraft = React.useCallback((row) => {
    const provider = providers.find(item => item.name === row?.supplier || item.id === row?.providerId);
    const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
    const email = primaryContact?.email || primaryContact?.ema || provider?.email || "";
    if (!email) {
      return { ok: false, message: "El proveedor no tiene email registrado." };
    }
    const paymentDateLabel = row?.paymentDate ? fmtD(row.paymentDate) : "por definir";
    const supplierName = row?.supplier || provider?.name || "este proveedor";
    const resolved = resolveTransactionalEmailTemplate(props.empresa, "payables_supplier_contact", {
      contactName: primaryContact?.nombre || supplierName,
      companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
      supplierName,
      documentNumber: row?.folio || "sin folio",
      paymentDate: paymentDateLabel,
      totalFormatted: fmtM(row?.pending || row?.total || 0),
    });
    return {
      ok: true,
      draft: {
        tenantId: props.empresa?.id || "",
        templateKey: "payables_supplier_contact",
        subject: resolved.subject,
        to: email,
        body: resolved.body,
        entityType: "payable",
        entityId: row?.id || "",
        metadata: {
          companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
          supplierName,
          contactName: primaryContact?.nombre || "",
          documentNumber: row?.folio || "",
        },
      },
    };
  }, [props.empresa, providers]);
  const buildSupplierStatementEmailDraft = React.useCallback((source) => {
    const provider = providers.find(item => item.id === source?.id || item.id === source?.providerId || item.name === source?.supplier || item.name === source?.name);
    if (!provider) {
      return { ok: false, message: "No encontramos el proveedor para preparar el estado de cuenta." };
    }
    const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
    const email = primaryContact?.email || primaryContact?.ema || provider?.email || "";
    if (!email) {
      return { ok: false, message: "El proveedor no tiene email registrado." };
    }
    const supplierName = provider?.name || source?.supplier || "este proveedor";
    const payableDocs = Array.isArray(provider?.payables) ? provider.payables : [];
    if (!payableDocs.length) {
      return { ok: false, message: "El proveedor no tiene documentos registrados para armar el estado de cuenta." };
    }
    const documentLines = payableDocs
      .map(doc => `- ${doc.folio || "Sin folio"} · ${doc.docType || "Documento"} · Total ${fmtM(doc.total || 0)} · Pagado ${fmtM(doc.paid || 0)} · Saldo ${fmtM(doc.pending || 0)} · ${doc.status || "Pendiente"}`)
      .join("\n");
    const totals = payableDocs.reduce((acc, doc) => ({
      total: acc.total + Number(doc.total || 0),
      paid: acc.paid + Number(doc.paid || 0),
      pending: acc.pending + Number(doc.pending || 0),
    }), { total: 0, paid: 0, pending: 0 });
    const resolved = resolveTransactionalEmailTemplate(props.empresa, "payables_supplier_statement", {
      contactName: primaryContact?.nombre || supplierName,
      companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
      supplierName,
      documentLines,
      documentTotalFormatted: fmtM(totals.total),
      paidTotalFormatted: fmtM(totals.paid),
      pendingTotalFormatted: fmtM(totals.pending),
    });
    const detailTableHtml = `
      <table style="width:100%;border-collapse:collapse;margin:18px 0 16px 0;font-size:13px">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Documento</th>
              <th style="text-align:left;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Tipo</th>
              <th style="text-align:right;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Total</th>
              <th style="text-align:right;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Pagado</th>
              <th style="text-align:right;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Saldo</th>
              <th style="text-align:left;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${payableDocs.map((doc, index) => `
              <tr style="background:${index % 2 === 0 ? "#f8fbff" : "#ffffff"}">
                <td style="padding:10px 12px;border:1px solid #d7deeb">${escapeEmailHtml(doc.folio || "Sin folio")}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb">${escapeEmailHtml(doc.docType || "Documento")}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb;text-align:right">${escapeEmailHtml(fmtM(doc.total || 0))}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb;text-align:right">${escapeEmailHtml(fmtM(doc.paid || 0))}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb;text-align:right">${escapeEmailHtml(fmtM(doc.pending || 0))}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb">${escapeEmailHtml(doc.status || "Pendiente")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
    `.trim();
    const detailSummaryHtml = `
      <div style="margin:14px 0 18px 0;padding:14px 16px;border:1px solid #d7deeb;background:#f8fbff;border-radius:10px">
        <div style="margin-bottom:6px"><strong>Total documental:</strong> ${escapeEmailHtml(fmtM(totals.total))}</div>
        <div style="margin-bottom:6px"><strong>Total pagado:</strong> ${escapeEmailHtml(fmtM(totals.paid))}</div>
        <div><strong>Saldo pendiente:</strong> ${escapeEmailHtml(fmtM(totals.pending))}</div>
      </div>
    `.trim();
    return {
      ok: true,
      draft: {
        tenantId: props.empresa?.id || "",
        templateKey: "payables_supplier_statement",
        subject: resolved.subject,
        to: email,
        body: resolved.body,
        fixedHtmlBlocks: [detailTableHtml, detailSummaryHtml],
        fixedHtmlInsertAfterBlocks: 3,
        entityType: "supplier_statement",
        entityId: provider?.id || "",
        metadata: {
          companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
          supplierName,
          contactName: primaryContact?.nombre || "",
          documentCount: payableDocs.length,
          pendingTotal: totals.pending,
        },
      },
    };
  }, [props.empresa, providers]);
  const buildIssuedOrderEmailDraft = React.useCallback(async (row) => {
    const provider = providers.find(item => item.name === row?.supplier || item.id === row?.providerId);
    const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
    const email = primaryContact?.email || primaryContact?.ema || provider?.email || "";
    if (!email) {
      return { ok: false, message: "El proveedor no tiene email registrado." };
    }
    const supplierName = row?.supplier || provider?.name || "este proveedor";
    const issueDateLabel = row?.issueDate ? fmtD(row.issueDate) : "por definir";
    const resolved = resolveTransactionalEmailTemplate(props.empresa, "issued_purchase_order_supplier", {
      contactName: primaryContact?.nombre || supplierName,
      companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
      supplierName,
      documentNumber: row?.number || "sin número",
      issueDate: issueDateLabel,
      totalFormatted: fmtM(row?.amount || 0),
    });
    const attachments = [];
    if (row?.pdfUrl) {
      attachments.push({
        id: `issued-order-${row?.id || row?.number || "attachment"}`,
        type: "pdf",
        src: row.pdfUrl,
        name: row.pdfName || `${row?.number || "orden-compra"}.pdf`,
      });
    } else {
      try {
        const file = await buildIssuedOrderPdfFile(row, props.empresa);
        const src = await buildIssuedOrderPdfDataUrl(row, props.empresa);
        attachments.push({
          id: `issued-order-${row?.id || row?.number || "attachment"}`,
          type: "pdf",
          src,
          name: file.name,
        });
      } catch (error) {
        console.warn("[treasury-issued-order-email] No pudimos generar el PDF adjunto de la OC", error);
      }
    }
    return {
      ok: true,
      draft: {
        tenantId: props.empresa?.id || "",
        templateKey: "issued_purchase_order_supplier",
        subject: resolved.subject,
        to: email,
        body: resolved.body,
        attachments,
        entityType: "issued_purchase_order",
        entityId: row?.id || "",
        metadata: {
          companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
          supplierName,
          contactName: primaryContact?.nombre || "",
          documentNumber: row?.number || "",
          entityLabel: row?.number || row?.supplier || "OC emitida",
        },
      },
    };
  }, [props.empresa, providers]);
  const handleSupplierEmail = React.useCallback((row) => {
    openEmailComposer(buildSupplierEmailDraft(row));
  }, [buildSupplierEmailDraft, openEmailComposer]);
  const handleSupplierStatementEmail = React.useCallback((source) => {
    openEmailComposer(buildSupplierStatementEmailDraft(source));
  }, [buildSupplierStatementEmailDraft, openEmailComposer]);
  const handleIssuedOrderEmail = React.useCallback(async (row) => {
    openEmailComposer(await buildIssuedOrderEmailDraft(row));
  }, [buildIssuedOrderEmailDraft, openEmailComposer]);
  const handleOpenIssuedOrderPdf = React.useCallback(async (row) => {
    if (!row) return;
    try {
      const isManualPdf = String(row.pdfSource || "").startsWith("manual");
      if (isManualPdf && String(row.pdfUrl || "").trim()) {
        await openPdfSourceInNewTab(row.pdfUrl, row.pdfName || `${row.number || "orden-compra"}.pdf`);
        return;
      }
      const file = await buildIssuedOrderPdfFile(row, props.empresa);
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      await saveIssuedOrder({
        ...row,
        pdfUrl: await buildIssuedOrderPdfDataUrl(row, props.empresa),
        pdfName: row.pdfName || file.name,
        pdfSource: isManualPdf ? row.pdfSource : "generated",
      });
    } catch (error) {
      console.warn("[treasury-issued-order-pdf] No pudimos abrir el PDF de la OC", error);
      window.alert("No pudimos abrir el PDF de la orden de compra.");
    }
  }, [props.empresa, saveIssuedOrder]);
  const handleSupplierWhatsApp = row => {
    const provider = providers.find(item => item.name === row?.supplier || item.id === row?.providerId);
    const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
    const phone = primaryContact?.telefono || primaryContact?.tel || provider?.telefono || "";
    if (!phone) return;
    const paymentDateLabel = row?.paymentDate ? fmtD(row.paymentDate) : "por definir";
    openWhatsApp(
      phone,
      `Hola${primaryContact?.nombre ? ` ${primaryContact.nombre}` : ""}, te escribimos por el documento ${row?.folio || "sin folio"} de ${row?.supplier || "tu empresa"}. Fecha estimada de pago: ${paymentDateLabel}.`
    );
  };

  const applyTreasuryImport = React.useCallback(async (payload = {}) => {
    if (!canManageTreasury || !payload?.mode) return;
    setImportingTreasury(true);
    try {
      const empId = props.empresa?.id || "";
      const counters = { clients: 0, providers: 0, documents: 0, payments: 0, skippedPayments: 0 };
      if (payload.mode === "receivables") {
        const clientRows = [
          ...(Array.isArray(payload.clients) ? payload.clients : []),
          ...(Array.isArray(payload.documents) ? payload.documents : []).map(row => ({
            rut: row.clientRut,
            name: row.clientName,
          })),
        ];
        const clientMap = new Map((clientes || []).map(client => [client.id, client]));
        clientRows.forEach(row => {
          if (!row?.rut && !row?.name) return;
          const existing = findClientForImport(Array.from(clientMap.values()), { clientRut: row.rut, clientName: row.name });
          const id = existing?.id || uid();
          clientMap.set(id, {
            ...(existing || {}),
            id,
            empId,
            nom: row.name || existing?.nom || existing?.name || "Cliente sin nombre",
            rut: row.rut || existing?.rut || "",
            ema: row.email || existing?.ema || existing?.email || "",
            tel: row.phone || existing?.tel || existing?.telefono || "",
            creditLimit: Number(row.creditLimit || existing?.creditLimit || 0) || 0,
            cr: existing?.cr || today(),
          });
          if (!existing) counters.clients += 1;
        });
        const nextClients = Array.from(clientMap.values());
        if (typeof props.setClientes === "function") await props.setClientes(nextClients);

        const facturaMap = new Map((facturas || []).map(doc => [doc.id, doc]));
        const importedDocs = [];
        for (const row of Array.isArray(payload.documents) ? payload.documents : []) {
          const client = findClientForImport(nextClients, row);
          if (!client || !row.folio || !row.total) continue;
          const existing = (facturas || []).find(doc => {
            if (doc?.empId !== empId) return false;
            const folioMatch = normalizeImportLookupValue(doc?.correlativo || doc?.folio) === normalizeImportLookupValue(row.folio);
            const clientMatch = doc?.entidadId === client.id;
            return folioMatch && clientMatch;
          });
          const id = existing?.id || uid();
          const nextDoc = {
            ...(existing || {}),
            id,
            empId,
            tipo: "cliente",
            entidadId: client.id,
            tipoDoc: row.docType || existing?.tipoDoc || "Factura Afecta",
            documentTypeCode: row.documentTypeCode || existing?.documentTypeCode || "invoice_taxable",
            tipoDocumento: row.documentTypeCode || existing?.tipoDocumento || "invoice_taxable",
            correlativo: row.folio,
            fecha: row.issueDate || existing?.fecha || existing?.fechaEmision || today(),
            fechaEmision: row.issueDate || existing?.fechaEmision || existing?.fecha || today(),
            fechaVencimiento: row.dueDate || existing?.fechaVencimiento || "",
            total: Number(row.total || existing?.total || 0),
            montoNeto: Number(row.total || existing?.montoNeto || existing?.total || 0),
            estado: existing?.estado || "Emitida",
            cobranzaEstado: row.status || existing?.cobranzaEstado || "Pendiente de pago",
            obs: row.notes || existing?.obs || "",
            cr: existing?.cr || today(),
          };
          facturaMap.set(id, nextDoc);
          importedDocs.push(nextDoc);
          counters.documents += 1;
        }
        if (typeof props.setFacturas === "function" && importedDocs.length) await props.setFacturas(Array.from(facturaMap.values()));

        const facturaList = Array.from(facturaMap.values());
        for (const row of Array.isArray(payload.payments) ? payload.payments : []) {
          const target = facturaList.find(doc => {
            if (doc?.empId !== empId) return false;
            const folioMatch = normalizeImportLookupValue(doc?.correlativo || doc?.folio) === normalizeImportLookupValue(row.folio);
            if (!folioMatch) return false;
            if (!row.clientRut) return true;
            const client = nextClients.find(item => item.id === doc.entidadId);
            return normalizeRutLookup(client?.rut) === normalizeRutLookup(row.clientRut);
          });
          if (!target) {
            counters.skippedPayments += 1;
            continue;
          }
          const ok = await saveReceipt({
            id: uid(),
            empId,
            invoiceId: target.id,
            date: row.date || today(),
            amount: Number(row.amount || 0),
            method: row.method || "Transferencia",
            reference: row.reference || row.folio || "",
            notes: row.notes || "",
          });
          counters.payments += ok ? 1 : 0;
        }
      } else {
        const providerRows = [
          ...(Array.isArray(payload.providers) ? payload.providers : []),
          ...(Array.isArray(payload.documents) ? payload.documents : []).map(row => ({
            rut: row.providerRut,
            name: row.providerName,
            currency: row.currency,
            email: row.providerEmail,
            paymentEmail: row.providerPaymentEmail,
            bank: row.providerBank,
            accountType: row.providerAccountType,
            accountNumber: row.providerAccountNumber,
          })),
        ];
        const providerMap = new Map((providers || []).map(provider => [provider.id, provider]));
        providerRows.forEach(row => {
          if (!row?.rut && !row?.name) return;
          const existing = findProviderForImport(Array.from(providerMap.values()), { providerRut: row.rut, providerName: row.name });
          const id = existing?.id || uid();
          const contactEmail = row.email || row.paymentEmail || "";
          const bankAccount = row.bank || row.accountNumber
            ? [{
                id: existing?.bankAccounts?.[0]?.id || uid(),
                banco: row.bank || existing?.bankAccounts?.[0]?.banco || "",
                titular: row.name || existing?.bankAccounts?.[0]?.titular || existing?.name || "",
                rut: row.rut || existing?.bankAccounts?.[0]?.rut || existing?.rut || "",
                tipoCuenta: row.accountType || existing?.bankAccounts?.[0]?.tipoCuenta || "",
                numeroCuenta: row.accountNumber || existing?.bankAccounts?.[0]?.numeroCuenta || "",
                emailPago: row.paymentEmail || contactEmail || existing?.bankAccounts?.[0]?.emailPago || "",
              }]
            : (existing?.bankAccounts || []);
          const contactos = contactEmail || row.phone
            ? [{
                id: existing?.contactos?.[0]?.id || uid(),
                nombre: existing?.contactos?.[0]?.nombre || "Contacto principal",
                cargo: existing?.contactos?.[0]?.cargo || "",
                email: contactEmail || existing?.contactos?.[0]?.email || "",
                telefono: row.phone || existing?.contactos?.[0]?.telefono || "",
              }]
            : (existing?.contactos || []);
          providerMap.set(id, {
            ...(existing || {}),
            id,
            empId,
            name: row.name || existing?.name || existing?.razonSocial || "Proveedor sin nombre",
            razonSocial: row.name || existing?.razonSocial || existing?.name || "Proveedor sin nombre",
            rut: row.rut || existing?.rut || "",
            currency: normalizeTreasuryCurrency(row.currency || existing?.currency || "CLP"),
            contactos,
            bankAccounts: bankAccount,
          });
          if (!existing) counters.providers += 1;
        });
        const nextProviders = Array.from(providerMap.values());
        if (typeof props.treasury?.setProviders === "function") await props.treasury.setProviders(nextProviders);

        const localPayables = [...(payables || [])];
        for (const row of Array.isArray(payload.documents) ? payload.documents : []) {
          const provider = findProviderForImport(nextProviders, row);
          if (!provider || !row.folio || !row.total) continue;
          const existing = findPayableDocForImport(localPayables, row);
          const nextDoc = {
            ...(existing || {}),
            id: existing?.id || uid(),
            empId,
            providerId: provider.id,
            supplier: provider.name || row.providerName || "Proveedor sin nombre",
            rut: row.providerRut || provider.rut || existing?.rut || "",
            currency: normalizeTreasuryCurrency(row.currency || provider.currency || existing?.currency || "CLP"),
            docType: row.docType || existing?.docType || "Factura Afecta",
            folio: row.folio,
            category: row.category || existing?.category || "Servicio",
            issueDate: row.issueDate || existing?.issueDate || today(),
            dueDate: row.dueDate || existing?.dueDate || "",
            paymentDate: row.paymentDate || existing?.paymentDate || "",
            total: Number(row.total || existing?.total || 0),
            status: row.status || existing?.status || "Pendiente",
            notes: row.notes || existing?.notes || "",
          };
          const currentIndex = localPayables.findIndex(item => item.id === nextDoc.id);
          if (currentIndex >= 0) localPayables[currentIndex] = nextDoc;
          else localPayables.push(nextDoc);
          const ok = await savePayable(nextDoc);
          counters.documents += ok ? 1 : 0;
        }

        for (const row of Array.isArray(payload.payments) ? payload.payments : []) {
          const target = findPayableDocForImport(localPayables, row);
          if (!target) {
            counters.skippedPayments += 1;
            continue;
          }
          const ok = await saveDisbursement({
            id: uid(),
            empId,
            payableId: target.id,
            date: row.date || today(),
            amount: Number(row.amount || 0),
            method: row.method || "Transferencia",
            reference: row.reference || row.folio || "",
            notes: row.notes || "",
          });
          counters.payments += ok ? 1 : 0;
        }
      }
      const entityCount = payload.mode === "receivables" ? counters.clients : counters.providers;
      const entityLabel = payload.mode === "receivables" ? "cliente(s)" : "proveedor(es)";
      props.ntf?.(`Importación lista: ${entityCount} ${entityLabel}, ${counters.documents} documento(s), ${counters.payments} pago(s).${counters.skippedPayments ? ` ${counters.skippedPayments} pago(s) sin documento asociado.` : ""}`);
      setImporterMode(null);
    } catch (error) {
      console.error("[treasury-import] Error al importar datos", error);
      props.ntf?.("No pudimos completar la importación. Revisa la planilla e intenta nuevamente.", "warn");
    } finally {
      setImportingTreasury(false);
    }
  }, [canManageTreasury, clientes, facturas, payables, props, providers, saveDisbursement, savePayable, saveReceipt]);

  const deleteMany = async (ids = [], deleter) => {
    if (!ids.length || !deleter) return;
    setPendingBulkDelete({ ids, deleter });
  };
  const otherCurrencyBalances = (payablesSummary.otherCurrencies || [])
    .map(item => formatTreasuryMoney(item.pending, item.currency))
    .join(" · ");
  const otherCurrencyPayments = (disbursementSummary.otherCurrencies || [])
    .map(item => formatTreasuryMoney(item.total, item.currency))
    .join(" · ");
  const otherCurrencyMetric = otherCurrencyBalances
    ? {
        label: "Otras monedas",
        value: otherCurrencyBalances,
        tone: "#2b6df6",
        wide: true,
        hint: otherCurrencyPayments
          ? `Pagos realizados: ${otherCurrencyPayments}. Montos sin convertir a CLP.`
          : "Saldos pendientes separados, sin convertir a CLP.",
      }
    : null;
  const otherCurrencyKpi = otherCurrencyBalances
    ? {
        color: "#2b6df6",
        label: "Otras monedas",
        value: otherCurrencyBalances,
        sub: "Saldos sin convertir a CLP",
        scope: "CxP",
      }
    : null;
  const treasuryHero = tab === 0
    ? {
        badge: { label: "Foco en cobranza", color: "cyan" },
        secondaryBadge: { label: `${receivableSummary.overdueDocs} docs vencidos`, color: receivableSummary.overdueDocs ? "yellow" : "green" },
        tertiaryBadge: { label: `${receiptsSummary.docs} pagos recibidos`, color: "gray" },
        metrics: [
          { label: "Cartera total", value: fmtM(receivableSummary.total), tone: "var(--cy2)", hint: "Lectura consolidada de cuentas por cobrar." },
          { label: "Pendiente", value: fmtM(receivableSummary.pending), tone: "#ffcc44", hint: "Monto abierto aún no conciliado." },
          { label: "Vencido", value: fmtM(receivableSummary.overdue), tone: "var(--red)", hint: `${receivableSummary.overdueDocs} documento(s) con atraso.` },
          { label: "Pagos recibidos", value: fmtM(receiptsSummary.total), tone: "#00e08a", hint: `${receiptsSummary.docs} registro(s) conciliados manualmente.` },
        ],
        kpis: [
          { color: "var(--cy2)", label: "Cartera total", value: fmtM(receivableSummary.total), scope: "CxC" },
          { color: "#ffcc44", label: "Pendiente", value: fmtM(receivableSummary.pending), scope: "CxC" },
          { color: "var(--red)", label: "Vencido", value: fmtM(receivableSummary.overdue), sub: `${receivableSummary.overdueDocs} docs con atraso`, scope: "CxC" },
          { color: "#00e08a", label: "Pagos recibidos", value: fmtM(receiptsSummary.total), sub: `${receiptsSummary.docs} conciliación(es)`, scope: "CxC" },
        ],
      }
    : {
        badge: { label: "Foco en egresos", color: "purple" },
        secondaryBadge: { label: `${payablesSummary.docs} cuentas por pagar`, color: "gray" },
        tertiaryBadge: { label: `${issuedOrderSummary.docs} OC emitidas`, color: "cyan" },
        metrics: [
          { label: "Documentos por pagar", value: fmtM(payablesSummary.total), tone: "#a78bfa", hint: `${payablesSummary.docs} documento(s) registrados en cuentas por pagar.` },
          { label: "Pendiente de pago", value: fmtM(payablesSummary.pending), tone: "#ffcc44", hint: "Saldo aún no desembolsado." },
          { label: "Vencido", value: fmtM(payablesSummary.overdue), tone: "var(--red)", hint: "Documentos atrasados dentro de la salida de caja." },
          { label: "Pagos realizados", value: fmtM(disbursementSummary.total), tone: "#00e08a", hint: `${disbursementSummary.docs} desembolso(s) registrados.` },
          ...(otherCurrencyMetric ? [otherCurrencyMetric] : []),
        ],
        kpis: [
          { color: "#a78bfa", label: "Documentos por pagar", value: fmtM(payablesSummary.total), sub: `${payablesSummary.docs} registrados`, scope: "CxP" },
          { color: "#ffcc44", label: "Pendiente", value: fmtM(payablesSummary.pending), scope: "CxP" },
          { color: "var(--red)", label: "Vencido", value: fmtM(payablesSummary.overdue), sub: "saldo con atraso", scope: "CxP" },
          { color: "#00e08a", label: "Pagos realizados", value: fmtM(disbursementSummary.total), sub: `${disbursementSummary.docs} desembolso(s)`, scope: "CxP" },
          ...(otherCurrencyKpi ? [otherCurrencyKpi] : []),
        ],
      };
  return (
    <div className="treasury-shell">
      <TreasuryStyles />
      <div style={{padding:"22px 22px 18px",border:"1px solid var(--bdr2)",borderRadius:24,background:"linear-gradient(180deg,#f7fbff 0%, #eef4fb 100%)",marginBottom:18,boxShadow:"0 14px 30px rgba(148,163,184,.18)"}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.45fr) minmax(320px,.95fr)",gap:16,alignItems:"stretch"}}>
          <div style={{display:"grid",gap:12}}>
            <ModuleHeader
              module="Tesorería"
              title="Tesorería"
              description="Controla cartera, deuda, cobranza operativa, conciliación documental y pagos realizados desde una misma superficie financiera."
            />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {treasuryHero.metrics.map(metric => (
              <TreasurySurfaceMetric
                key={metric.label}
                label={metric.label}
                value={metric.value}
                tone={metric.tone}
                hint={metric.hint}
                wide={metric.wide}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="treasury-tabs">
        <button className={`treasury-tab ${tab === 0 ? "active" : ""}`} onClick={() => setTab(0)}>Cuentas por Cobrar</button>
        <button className={`treasury-tab ${tab === 1 ? "active" : ""}`} onClick={() => setTab(1)}>Cuentas por Pagar</button>
      </div>
      <div className="treasury-state-note">
        <strong>Estado Anulado:</strong> úsalo solo cuando el documento fue emitido con error y se anula desde el emisor. Produ mantiene la trazabilidad, pero el monto no se considera en cartera, deuda, vencidos ni totales operativos.
      </div>
      {tab === 0 ? (
        <>
          <TreasuryReceivablesSection
            canManageTreasury={canManageTreasury}
            clientes={clientes}
            closePortfolioDetail={() => setPortfolioOpen(false)}
            closePurchaseOrder={closePurchaseOrder}
            facturas={facturas}
            openPortfolioDetail={openPortfolioDetail}
            openBulkImporter={() => openTreasuryImporter("receivables")}
            openPurchaseOrderEdit={openPurchaseOrderEdit}
            openReceiptCreate={openReceiptCreate}
            poDraft={poDraft}
            poOpen={poOpen}
            portfolioItem={portfolioItem}
            portfolioOpen={portfolioOpen}
            portfolioTable={portfolioTable}
            props={{
              ...props,
              poTable,
              openPurchaseOrderCreate,
              deletePurchaseOrder,
              deleteMany,
            }}
            purchaseOrderSummary={purchaseOrderSummary}
            deleteMany={deleteMany}
            deleteReceipt={deleteReceipt}
            receiptClientFilter={receiptClientFilter}
            receiptClientOptions={receiptClientOptions}
            receiptDraft={receiptDraft}
            receiptOpen={receiptOpen}
            receiptPeriodFilter={receiptPeriodFilter}
            receiptPeriodOptions={receiptPeriodOptions}
            receiptTable={receiptTable}
            receivableTable={receivableTable}
            openReceiptEdit={openReceiptEdit}
            onUpdateReceivableStatus={handleReceivableStatusUpdate}
            savePurchaseOrder={savePurchaseOrder}
            saveReceipt={saveReceipt}
            sendBillingEmail={openBillingEmailComposer}
            sendBillingWhatsApp={sendBillingWhatsApp}
            sendPaymentLinkEmail={openPaymentLinkEmailComposer}
            sendPaymentLinkWhatsApp={sendPaymentLinkWhatsApp}
            generateMercadoPagoPaymentLink={generateMercadoPagoPaymentLink}
            refreshMercadoPagoPaymentStatus={refreshMercadoPagoPaymentStatus}
            simulateMercadoPagoPayment={simulateMercadoPagoPayment}
            sendStatementEmail={openStatementEmailComposer}
            sendStatementWhatsApp={sendStatementWhatsApp}
            closeReceipt={closeReceipt}
            setReceiptClientFilter={setReceiptClientFilter}
            setReceiptPeriodFilter={setReceiptPeriodFilter}
          />
          <TreasuryPurchaseOrderModal open={poOpen} data={poDraft} clientes={clientes} facturas={facturas} onClose={closePurchaseOrder} onSave={savePurchaseOrder} />
        </>
      ) : (
        <>
          <TreasuryPayablesSection
            canManageTreasury={canManageTreasury}
            deleteMany={deleteMany}
            deleteDisbursement={deleteDisbursement}
            deleteIssuedOrder={deleteIssuedOrder}
            deletePayable={deletePayable}
            deleteProvider={deleteProvider}
            disbursementPeriodFilter={disbursementPeriodFilter}
            disbursementPeriodOptions={disbursementPeriodOptions}
            disbursementSupplierFilter={disbursementSupplierFilter}
            disbursementSupplierOptions={disbursementSupplierOptions}
            disbursementTable={disbursementTable}
            handlePayableUpdate={handlePayableUpdate}
            handleSupplierEmail={handleSupplierEmail}
            handleSupplierStatementEmail={handleSupplierStatementEmail}
            handleSupplierWhatsApp={handleSupplierWhatsApp}
            issuedOrderSummary={issuedOrderSummary}
            sendIssuedOrderEmail={handleIssuedOrderEmail}
            openIssuedOrderPdf={handleOpenIssuedOrderPdf}
            openIssuedOrderDetail={openIssuedOrderDetail}
            issuedSupplierFilter={issuedSupplierFilter}
            issuedSupplierOptions={issuedSupplierOptions}
            issuedTable={issuedTable}
            openDisbursementCreate={openDisbursementCreate}
            openDisbursementEdit={openDisbursementEdit}
            openIssuedOrderCreate={openIssuedOrderCreate}
            openIssuedOrderEdit={openIssuedOrderEdit}
            openPayableCreate={openPayableCreate}
            openPayableEdit={openPayableEdit}
            openBulkImporter={() => openTreasuryImporter("payables")}
            openProviderCreate={openProviderCreate}
            openProviderEdit={openProviderEdit}
            payablePeriodFilter={payablePeriodFilter}
            payablePeriodOptions={payablePeriodOptions}
            payableSupplierFilter={payableSupplierFilter}
            payableSupplierOptions={payableSupplierOptions}
            payableTable={payableTable}
            payablesSummary={payablesSummary}
            payablesTab={payablesTab}
            providerTable={providerTable}
            providers={providers}
            setDisbursementPeriodFilter={setDisbursementPeriodFilter}
            setDisbursementSupplierFilter={setDisbursementSupplierFilter}
            setIssuedSupplierFilter={setIssuedSupplierFilter}
            setPayablePeriodFilter={setPayablePeriodFilter}
            setPayableSupplierFilter={setPayableSupplierFilter}
            setPayablesTab={setPayablesTab}
            empresa={props.empresa}
            isMobile={props.isMobile}
          />
          <TreasuryPayableModal open={payableOpen} data={payableDraft} providers={providers} listas={props.listas} onClose={closePayable} onSave={savePayable} />
          <TreasuryIssuedOrderModal open={issuedOpen} data={issuedDraft} providers={providers} empresa={props.empresa} user={props.user} producciones={props.producciones} programas={props.programas} piezas={props.piezas} onClose={closeIssuedOrder} onSave={saveIssuedOrder} />
          <TreasuryPaymentModal open={disbursementOpen} title="Registrar pago realizado" subtitle="Asocia el pago a la cuenta por pagar correspondiente" data={disbursementDraft} onClose={closeDisbursement} onSave={saveDisbursement} />
        </>
      )}
      <PortfolioDetailModal open={portfolioOpen} item={portfolioItem} onClose={() => setPortfolioOpen(false)} onEditOrder={canManageTreasury ? row => { setPortfolioOpen(false); openPurchaseOrderEdit(row); } : null} canManage={canManageTreasury} />
      <ProviderDetailModal open={providerOpen} provider={providerDraft} paymentRows={providerPaymentRows} canManage={canManageTreasury} onUpdatePayable={handlePayableUpdate} onSupplierEmail={handleSupplierEmail} onSupplierStatementEmail={handleSupplierStatementEmail} onSupplierWhatsApp={handleSupplierWhatsApp} onClose={closeProvider} onSave={saveProvider} empresa={props.empresa} platformApi={props.platformApi} currentUser={props.user} ntf={props.ntf} />
      <IssuedOrderDetailModal
        open={issuedDetailOpen}
        order={issuedDetailItem}
        provider={providers.find(item => item.id === issuedDetailItem?.providerId || item.name === issuedDetailItem?.supplier) || null}
        onClose={closeIssuedOrderDetail}
        onEdit={canManageTreasury ? row => {
          closeIssuedOrderDetail();
          openIssuedOrderEdit(row);
        } : null}
        onEmail={handleIssuedOrderEmail}
        onOpenPdf={handleOpenIssuedOrderPdf}
      />
      <TransactionalEmailComposerModal
        open={emailComposerOpen}
        draft={emailComposerDraft}
        sending={emailComposerSending}
        onClose={closeEmailComposer}
        onSend={handleSendComposedEmail}
      />
      <ConfirmActionDialog
        open={Boolean(pendingBulkDelete)}
        title="Eliminar registros"
        message={`¿Eliminar ${pendingBulkDelete?.ids?.length || 0} registro${(pendingBulkDelete?.ids?.length || 0) === 1 ? "" : "s"} seleccionado${(pendingBulkDelete?.ids?.length || 0) === 1 ? "" : "s"}?`}
        confirmLabel="Eliminar"
        onClose={() => setPendingBulkDelete(null)}
        onConfirm={() => {
          const current = pendingBulkDelete;
          setPendingBulkDelete(null);
          if (!current?.ids?.length || !current?.deleter) return;
          void (async () => {
            for (const id of current.ids) {
              // Keep sequential writes so the current store setters stay consistent.
              // This is slower than batching, but safer with the current module contract.
              await current.deleter(id);
            }
          })();
        }}
      />
      <TreasuryBulkImporterModal
        open={Boolean(importerMode)}
        mode={importerMode || "payables"}
        applying={importingTreasury}
        onClose={closeTreasuryImporter}
        onApply={applyTreasuryImport}
      />
    </div>
  );
}
