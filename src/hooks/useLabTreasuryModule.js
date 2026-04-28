import { useEffect, useMemo, useState } from "react";
import { appendOperationalAuditEntry } from "../lib/operations/operationalAudit";
import {
  buildTreasuryProviders,
  buildTreasuryDisbursementLog,
  buildTreasuryIssuedOrders,
  buildTreasuryPayables,
  buildTreasuryPortfolio,
  buildTreasuryPurchaseOrders,
  buildTreasuryReceiptLog,
  buildTreasuryReceivables,
  summarizeIssuedOrders,
  summarizePurchaseOrders,
  summarizeStoredPayables,
  summarizeTreasuryReceivables,
  recoverTreasuryDisbursementsFromProviders,
} from "../lib/utils/treasury";

export function useLabTreasuryModule({
  empresa,
  clientes,
  auspiciadores,
  facturas,
  canDo,
  treasury = {},
  currentUser = null,
  platformServices = null,
}) {
  const empId = empresa?.id || "";
  const canManageTreasury = !!(canDo && canDo("tesoreria"));
  const treasuryProviders = treasury.providers || [];
  const setTreasuryProviders = treasury.setProviders;
  const treasuryPayables = treasury.payables || [];
  const setTreasuryPayables = treasury.setPayables;
  const treasuryPurchaseOrders = treasury.purchaseOrders || [];
  const setTreasuryPurchaseOrders = treasury.setPurchaseOrders;
  const treasuryIssuedOrders = treasury.issuedOrders || [];
  const setTreasuryIssuedOrders = treasury.setIssuedOrders;
  const treasuryReceipts = treasury.receipts || [];
  const setTreasuryReceipts = treasury.setReceipts;
  const treasuryDisbursements = treasury.disbursements || [];
  const setTreasuryDisbursements = treasury.setDisbursements;
  const treasuryDisbursementsRecovered = useMemo(
    () => recoverTreasuryDisbursementsFromProviders({ providers: treasuryProviders, empId }),
    [treasuryProviders, empId],
  );
  const effectiveTreasuryDisbursements = Array.isArray(treasuryDisbursements) && treasuryDisbursements.length
    ? treasuryDisbursements
    : treasuryDisbursementsRecovered;

  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [payableOpen, setPayableOpen] = useState(false);
  const [payableDraft, setPayableDraft] = useState(null);
  const [poOpen, setPoOpen] = useState(false);
  const [poDraft, setPoDraft] = useState(null);
  const [issuedOpen, setIssuedOpen] = useState(false);
  const [issuedDraft, setIssuedDraft] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptDraft, setReceiptDraft] = useState(null);
  const [disbursementOpen, setDisbursementOpen] = useState(false);
  const [disbursementDraft, setDisbursementDraft] = useState(null);
  const [providerOpen, setProviderOpen] = useState(false);
  const [providerDraft, setProviderDraft] = useState(null);

  const withEmp = (next = {}) => ({ ...next, empId });

  const receivables = useMemo(() => buildTreasuryReceivables({
    facturas,
    clientes,
    auspiciadores,
    receipts: treasuryReceipts,
    empId,
  }), [facturas, clientes, auspiciadores, treasuryReceipts, empId]);

  const filteredReceivables = useMemo(() => {
    const term = String(q || "").trim().toLowerCase();
    return receivables.filter(row => {
      const matchesTerm = !term || [
        row.correlativo,
        row.entidad,
        row.tipoDoc,
      ].some(value => String(value || "").toLowerCase().includes(term));
      const matchesStatus = !statusFilter || row.bucket === statusFilter || row.cobranza === statusFilter;
      return matchesTerm && matchesStatus;
    });
  }, [receivables, q, statusFilter]);

  const receivableSummary = useMemo(
    () => summarizeTreasuryReceivables(receivables),
    [receivables],
  );

  const payables = useMemo(
    () => buildTreasuryPayables({ payables: treasuryPayables, disbursements: effectiveTreasuryDisbursements, empId }),
    [treasuryPayables, effectiveTreasuryDisbursements, empId],
  );

  const payablesSummary = useMemo(
    () => summarizeStoredPayables(payables),
    [payables],
  );

  const purchaseOrders = useMemo(
    () => buildTreasuryPurchaseOrders({ orders: treasuryPurchaseOrders, facturas, clientes, receipts: treasuryReceipts, empId }),
    [treasuryPurchaseOrders, facturas, clientes, treasuryReceipts, empId],
  );

  const portfolio = useMemo(
    () => buildTreasuryPortfolio({ rows: receivables, clientes, purchaseOrders }),
    [receivables, clientes, purchaseOrders],
  );

  const purchaseOrderSummary = useMemo(
    () => summarizePurchaseOrders(purchaseOrders),
    [purchaseOrders],
  );

  const issuedOrders = useMemo(
    () => buildTreasuryIssuedOrders({ orders: treasuryIssuedOrders, empId }),
    [treasuryIssuedOrders, empId],
  );

  const issuedOrderSummary = useMemo(
    () => summarizeIssuedOrders(issuedOrders),
    [issuedOrders],
  );

  const providers = useMemo(
    () => buildTreasuryProviders({ providers: treasuryProviders, payables, issuedOrders, empId }),
    [treasuryProviders, payables, issuedOrders, empId],
  );

  const receiptLog = useMemo(
    () => buildTreasuryReceiptLog({ receipts: treasuryReceipts, facturas, empId }),
    [treasuryReceipts, facturas, empId],
  );

  const disbursementLog = useMemo(
    () => buildTreasuryDisbursementLog({ disbursements: effectiveTreasuryDisbursements, payables: treasuryPayables, empId }),
    [effectiveTreasuryDisbursements, treasuryPayables, empId],
  );

  useEffect(() => {
    if (Array.isArray(treasuryDisbursements) && treasuryDisbursements.length) return;
    if (!treasuryDisbursementsRecovered.length) return;
    Promise.resolve(setTreasuryDisbursements?.(treasuryDisbursementsRecovered)).catch(() => {});
  }, [setTreasuryDisbursements, treasuryDisbursements, treasuryDisbursementsRecovered]);

  const savePayable = async next => {
    if (!canManageTreasury) return false;
    if (!empId) return false;
    const safeNext = withEmp(next);
    const exists = treasuryPayables.some(item => item.id === safeNext.id);
    const updated = exists
      ? treasuryPayables.map(item => item.id === safeNext.id ? safeNext : item)
      : [...treasuryPayables, safeNext];
    await setTreasuryPayables?.(updated);
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: exists ? "payable_updated" : "payable_created",
      entityType: "treasury_payable",
      entityId: safeNext.id || "",
      actor: currentUser,
      payload: {
        supplier: safeNext.supplier || "",
        folio: safeNext.folio || "",
        total: Number(safeNext.total || 0),
        status: safeNext.status || "",
      },
      platformServices,
    });
    setPayableOpen(false);
    setPayableDraft(null);
    return true;
  };

  const deletePayable = async id => {
    if (!canManageTreasury) return false;
    await setTreasuryPayables?.(treasuryPayables.filter(item => item.id !== id));
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: "payable_deleted",
      entityType: "treasury_payable",
      entityId: id || "",
      actor: currentUser,
      payload: {},
      platformServices,
    });
    return true;
  };

  const savePurchaseOrder = async next => {
    if (!canManageTreasury) return false;
    if (!empId) return false;
    const safeNext = withEmp(next);
    const exists = treasuryPurchaseOrders.some(item => item.id === safeNext.id);
    const updated = exists
      ? treasuryPurchaseOrders.map(item => item.id === safeNext.id ? safeNext : item)
      : [...treasuryPurchaseOrders, safeNext];
    await setTreasuryPurchaseOrders?.(updated);
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: exists ? "purchase_order_updated" : "purchase_order_created",
      entityType: "treasury_purchase_order",
      entityId: safeNext.id || "",
      actor: currentUser,
      payload: {
        number: safeNext.number || "",
        clientId: safeNext.clientId || "",
        amount: Number(safeNext.amount || 0),
        status: safeNext.status || "",
      },
      platformServices,
    });
    setPoOpen(false);
    setPoDraft(null);
    return true;
  };

  const deletePurchaseOrder = async id => {
    if (!canManageTreasury) return false;
    await setTreasuryPurchaseOrders?.(treasuryPurchaseOrders.filter(item => item.id !== id));
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: "purchase_order_deleted",
      entityType: "treasury_purchase_order",
      entityId: id || "",
      actor: currentUser,
      payload: {},
      platformServices,
    });
    return true;
  };

  const saveIssuedOrder = async next => {
    if (!canManageTreasury) return false;
    if (!empId) return false;
    const safeNext = withEmp(next);
    const exists = treasuryIssuedOrders.some(item => item.id === safeNext.id);
    const updated = exists
      ? treasuryIssuedOrders.map(item => item.id === safeNext.id ? safeNext : item)
      : [...treasuryIssuedOrders, safeNext];
    await setTreasuryIssuedOrders?.(updated);
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: exists ? "issued_order_updated" : "issued_order_created",
      entityType: "treasury_issued_order",
      entityId: safeNext.id || "",
      actor: currentUser,
      payload: {
        supplier: safeNext.supplier || "",
        number: safeNext.number || "",
        amount: Number(safeNext.amount || 0),
      },
      platformServices,
    });
    setIssuedOpen(false);
    setIssuedDraft(null);
    return true;
  };

  const deleteIssuedOrder = async id => {
    if (!canManageTreasury) return false;
    await setTreasuryIssuedOrders?.(treasuryIssuedOrders.filter(item => item.id !== id));
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: "issued_order_deleted",
      entityType: "treasury_issued_order",
      entityId: id || "",
      actor: currentUser,
      payload: {},
      platformServices,
    });
    return true;
  };

  const saveReceipt = async next => {
    if (!canManageTreasury) return false;
    if (!empId) return false;
    const nextAmount = Number(next.amount || 0);
    const maxAmount = Number(next.maxAmount || 0);
    if (!nextAmount || nextAmount <= 0) return false;
    if (maxAmount > 0 && nextAmount > maxAmount) return false;
    const safeNext = { ...next, empId, amount: nextAmount };
    const exists = treasuryReceipts.some(item => item.id === safeNext.id);
    const updated = exists
      ? treasuryReceipts.map(item => item.id === safeNext.id ? safeNext : item)
      : [...treasuryReceipts, safeNext];
    await setTreasuryReceipts?.(updated);
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: exists ? "receipt_updated" : "receipt_created",
      entityType: "treasury_receipt",
      entityId: safeNext.id || "",
      actor: currentUser,
      payload: {
        invoiceId: safeNext.invoiceId || "",
        amount: Number(safeNext.amount || 0),
        method: safeNext.method || "",
        reference: safeNext.reference || "",
      },
      platformServices,
    });
    setReceiptOpen(false);
    setReceiptDraft(null);
    return true;
  };

  const saveDisbursement = async next => {
    if (!canManageTreasury) return false;
    if (!empId) return false;
    const nextAmount = Number(next.amount || 0);
    const maxAmount = Number(next.maxAmount || 0);
    if (!nextAmount || nextAmount <= 0) return false;
    if (maxAmount > 0 && nextAmount > maxAmount) return false;
    const safeNext = { ...next, empId, amount: nextAmount };
    const baseDisbursements = Array.isArray(treasuryDisbursements) ? treasuryDisbursements : effectiveTreasuryDisbursements;
    const exists = baseDisbursements.some(item => item.id === safeNext.id);
    const updated = exists
      ? baseDisbursements.map(item => item.id === safeNext.id ? safeNext : item)
      : [...baseDisbursements, safeNext];
    await setTreasuryDisbursements?.(updated);
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: exists ? "disbursement_updated" : "disbursement_created",
      entityType: "treasury_disbursement",
      entityId: safeNext.id || "",
      actor: currentUser,
      payload: {
        payableId: safeNext.payableId || "",
        amount: Number(safeNext.amount || 0),
        method: safeNext.method || "",
        reference: safeNext.reference || "",
      },
      platformServices,
    });
    setDisbursementOpen(false);
    setDisbursementDraft(null);
    return true;
  };

  const saveProvider = async next => {
    if (!canManageTreasury) return false;
    if (!empId) return false;
    const safeNext = withEmp(next);
    const exists = treasuryProviders.some(item => item.id === safeNext.id);
    const updated = exists
      ? treasuryProviders.map(item => item.id === safeNext.id ? safeNext : item)
      : [...treasuryProviders, safeNext];
    await setTreasuryProviders?.(updated);
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: exists ? "provider_updated" : "provider_created",
      entityType: "treasury_provider",
      entityId: safeNext.id || "",
      actor: currentUser,
      payload: {
        name: safeNext.name || "",
        rut: safeNext.rut || "",
        providerType: safeNext.tipoProveedor || "",
      },
      platformServices,
    });
    setProviderOpen(false);
    setProviderDraft(null);
    return true;
  };

  const deleteProvider = async id => {
    if (!canManageTreasury) return false;
    await setTreasuryProviders?.(treasuryProviders.filter(item => item.id !== id));
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: "provider_deleted",
      entityType: "treasury_provider",
      entityId: id || "",
      actor: currentUser,
      payload: {},
      platformServices,
    });
    return true;
  };

  const deleteReceipt = async id => {
    if (!canManageTreasury) return false;
    await setTreasuryReceipts?.(treasuryReceipts.filter(item => item.id !== id));
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: "receipt_deleted",
      entityType: "treasury_receipt",
      entityId: id || "",
      actor: currentUser,
      payload: {},
      platformServices,
    });
    return true;
  };

  const deleteDisbursement = async id => {
    if (!canManageTreasury) return false;
    await setTreasuryDisbursements?.(treasuryDisbursements.filter(item => item.id !== id));
    await appendOperationalAuditEntry({
      empId,
      area: "tesoreria",
      action: "disbursement_deleted",
      entityType: "treasury_disbursement",
      entityId: id || "",
      actor: currentUser,
      payload: {},
      platformServices,
    });
    return true;
  };

  const openPayableCreate = () => {
    if (!canManageTreasury) return false;
    setPayableDraft(null);
    setPayableOpen(true);
  };

  const openPayableEdit = row => {
    if (!canManageTreasury) return false;
    setPayableDraft(row);
    setPayableOpen(true);
  };

  const openPurchaseOrderCreate = () => {
    if (!canManageTreasury) return false;
    setPoDraft(null);
    setPoOpen(true);
  };

  const openPurchaseOrderEdit = row => {
    if (!canManageTreasury) return false;
    setPoDraft(row);
    setPoOpen(true);
  };

  const openIssuedOrderCreate = () => {
    if (!canManageTreasury) return false;
    setIssuedDraft(null);
    setIssuedOpen(true);
  };

  const openIssuedOrderEdit = row => {
    if (!canManageTreasury) return false;
    setIssuedDraft(row);
    setIssuedOpen(true);
  };

  const openReceiptCreate = row => {
    if (!canManageTreasury) return false;
    setReceiptDraft({
      empId,
      invoiceId: row.id,
      reference: row.correlativo,
      maxAmount: Math.max(0, Number(row.pending || 0)),
      amount: Math.max(0, Number(row.pending || 0)) || "",
    });
    setReceiptOpen(true);
  };

  const openDisbursementCreate = row => {
    if (!canManageTreasury) return false;
    setDisbursementDraft({
      empId,
      payableId: row.id,
      reference: row.folio || row.supplier,
      maxAmount: Math.max(0, Number(row.pending || 0)),
      amount: Math.max(0, Number(row.pending || 0)) || "",
    });
    setDisbursementOpen(true);
  };

  const openReceiptEdit = row => {
    if (!canManageTreasury) return false;
    setReceiptDraft(row);
    setReceiptOpen(true);
  };

  const openProviderCreate = () => {
    if (!canManageTreasury) return false;
    setProviderDraft({
      id: `prov-${Date.now()}`,
      empId,
      name: "",
      razonSocial: "",
      rut: "",
      direccion: "",
      tipoProveedor: "",
      contactos: [],
      bankAccounts: [],
      payables: [],
      issuedOrders: [],
      totalDebt: 0,
      paid: 0,
      pending: 0,
    });
    setProviderOpen(true);
  };

  const openProviderEdit = row => {
    if (!canManageTreasury) return false;
    setProviderDraft(row);
    setProviderOpen(true);
  };

  const openDisbursementEdit = row => {
    if (!canManageTreasury) return false;
    setDisbursementDraft(row);
    setDisbursementOpen(true);
  };

  const closePayable = () => {
    setPayableOpen(false);
    setPayableDraft(null);
  };

  const closePurchaseOrder = () => {
    setPoOpen(false);
    setPoDraft(null);
  };

  const closeIssuedOrder = () => {
    setIssuedOpen(false);
    setIssuedDraft(null);
  };

  const closeReceipt = () => {
    setReceiptOpen(false);
    setReceiptDraft(null);
  };

  const closeDisbursement = () => {
    setDisbursementOpen(false);
    setDisbursementDraft(null);
  };

  const closeProvider = () => {
    setProviderOpen(false);
    setProviderDraft(null);
  };

  return {
    tab,
    setTab,
    q,
    setQ,
    statusFilter,
    setStatusFilter,
    filteredReceivables,
    receivableSummary,
    portfolio,
    providers,
    payables,
    payablesSummary,
    purchaseOrders,
    purchaseOrderSummary,
    issuedOrders,
    issuedOrderSummary,
    receiptLog,
    disbursementLog,
    canManageTreasury,
    payableOpen,
    payableDraft,
    poOpen,
    poDraft,
    issuedOpen,
    issuedDraft,
    receiptOpen,
    receiptDraft,
    disbursementOpen,
    disbursementDraft,
    providerOpen,
    providerDraft,
    savePayable,
    deletePayable,
    savePurchaseOrder,
    deletePurchaseOrder,
    saveIssuedOrder,
    deleteIssuedOrder,
    saveReceipt,
    saveDisbursement,
    saveProvider,
    deleteProvider,
    deleteReceipt,
    deleteDisbursement,
    openPayableCreate,
    openPayableEdit,
    openPurchaseOrderCreate,
    openPurchaseOrderEdit,
    openIssuedOrderCreate,
    openIssuedOrderEdit,
    openReceiptCreate,
    openDisbursementCreate,
    openReceiptEdit,
    openDisbursementEdit,
    openProviderCreate,
    openProviderEdit,
    closePayable,
    closePurchaseOrder,
    closeIssuedOrder,
    closeReceipt,
    closeDisbursement,
    closeProvider,
  };
}
