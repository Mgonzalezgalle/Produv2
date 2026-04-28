import React, { useMemo, useState } from "react";
import {
  FilterSel,
  GBtn,
  ModuleHeader,
  Paginator,
} from "../../lib/ui/components";
import { fmtD, fmtM, fmtMonthPeriod, openWhatsApp } from "../../lib/utils/helpers";
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
import { TreasuryStyles, SectionCard, KpiCard, useTableState } from "./TreasuryCore";
import { TransactionalEmailComposerModal } from "../shared/TransactionalEmailComposerModal";
import { ConfirmActionDialog } from "../shared/ConfirmActionDialog";
import { buildIssuedOrderPdfDataUrl, buildIssuedOrderPdfFile } from "../../lib/utils/treasuryIssuedOrderPdf";

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
    statusOptions: ["Pendiente de pago", "Retrasado de pago", "Pagado", "Por vencer", "Vencido", "Ajuste crédito"],
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
  const payableTable = useTableState(filteredPayables, { searchFields: [row => row.supplier, row => row.folio], statusOptions: ["Pendiente", "Parcial", "Pagada", "Vencida"], getStatus: row => row.status, pageSize: 6 });
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
    return {
      ok: true,
      draft: {
        tenantId: props.empresa?.id || "",
        templateKey: "payables_supplier_statement",
        subject: resolved.subject,
        to: email,
        body: resolved.body,
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
  }, [fmtM, props.empresa, providers]);
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

  const deleteMany = async (ids = [], deleter) => {
    if (!ids.length || !deleter) return;
    setPendingBulkDelete({ ids, deleter });
  };

  return (
    <div className="treasury-shell">
      <TreasuryStyles />
      <ModuleHeader
        module="Tesorería"
        title="Tesorería"
        description="Controla la cartera, revisa concentración de deuda, gestiona la cobranza operativa, concilia órdenes de compra con facturas y registra pagos manuales recibidos o realizados."
      />
      <div className="treasury-kpis">
        <KpiCard color="var(--cy)" label="Cartera total" value={fmtM(receivableSummary.total)} scope="CxC" />
        <KpiCard color="#ffcc44" label="Pendiente" value={fmtM(receivableSummary.pending)} scope="CxC" />
        <KpiCard color="var(--red)" label="Vencido" value={fmtM(receivableSummary.overdue)} sub={`${receivableSummary.overdueDocs} docs con atraso`} scope="CxC" />
        <KpiCard color="#a78bfa" label="Egresos" value={fmtM(payablesSummary.total)} sub={`${payablesSummary.docs} documentos registrados`} scope="CxP" />
      </div>
      <div className="treasury-tabs">
        <button className={`treasury-tab ${tab === 0 ? "active" : ""}`} onClick={() => setTab(0)}>Cuentas por Cobrar</button>
        <button className={`treasury-tab ${tab === 1 ? "active" : ""}`} onClick={() => setTab(1)}>Cuentas por Pagar</button>
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
            saveFacturaDoc={saveFacturaDoc}
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
          />
          <TreasuryPayableModal open={payableOpen} data={payableDraft} providers={providers} listas={props.listas} onClose={closePayable} onSave={savePayable} />
          <TreasuryIssuedOrderModal open={issuedOpen} data={issuedDraft} providers={providers} empresa={props.empresa} user={props.user} producciones={props.producciones} programas={props.programas} piezas={props.piezas} onClose={closeIssuedOrder} onSave={saveIssuedOrder} />
          <TreasuryPaymentModal open={disbursementOpen} title="Registrar pago realizado" subtitle="Asocia el pago a la cuenta por pagar correspondiente" data={disbursementDraft} onClose={closeDisbursement} onSave={saveDisbursement} />
        </>
      )}
      <PortfolioDetailModal open={portfolioOpen} item={portfolioItem} onClose={() => setPortfolioOpen(false)} onEditOrder={canManageTreasury ? row => { setPortfolioOpen(false); openPurchaseOrderEdit(row); } : null} canManage={canManageTreasury} />
      <ProviderDetailModal open={providerOpen} provider={providerDraft} paymentRows={providerPaymentRows} canManage={canManageTreasury} onUpdatePayable={handlePayableUpdate} onSupplierEmail={handleSupplierEmail} onSupplierStatementEmail={handleSupplierStatementEmail} onSupplierWhatsApp={handleSupplierWhatsApp} onClose={closeProvider} onSave={saveProvider} />
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
    </div>
  );
}
