import { useEffect, useMemo, useRef, useState } from "react";
import { appendOperationalAuditEntry } from "../lib/operations/operationalAudit";
import { createFoundationFinancialRegistryCoordinator } from "../lib/backend/foundationFinancialRegistry";
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

function mergeById(items = [], nextItems = []) {
  const merged = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (!item?.id) return;
    merged.set(item.id, item);
  });
  (Array.isArray(nextItems) ? nextItems : []).forEach((item) => {
    if (!item?.id) return;
    merged.set(item.id, { ...(merged.get(item.id) || {}), ...item });
  });
  return Array.from(merged.values());
}

function sanitizeTreasuryReceipt(next = {}, empId = "") {
  const amount = Number(next?.amount || 0);
  return {
    ...next,
    id: String(next?.id || "").trim(),
    empId: String(next?.empId || empId || "").trim(),
    invoiceId: String(next?.invoiceId || "").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    method: String(next?.method || "").trim(),
    reference: String(next?.reference || "").trim(),
    date: String(next?.date || "").trim(),
  };
}

function sanitizeTreasuryDisbursement(next = {}, empId = "") {
  const amount = Number(next?.amount || 0);
  return {
    ...next,
    id: String(next?.id || "").trim(),
    empId: String(next?.empId || empId || "").trim(),
    payableId: String(next?.payableId || "").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    method: String(next?.method || "").trim(),
    reference: String(next?.reference || "").trim(),
    date: String(next?.date || "").trim(),
  };
}

function sanitizeTreasuryPayable(next = {}, empId = "") {
  const total = Number(next?.total || 0);
  return {
    ...next,
    id: String(next?.id || "").trim(),
    empId: String(next?.empId || empId || "").trim(),
    supplier: String(next?.supplier || "").trim(),
    docType: String(next?.docType || "").trim(),
    folio: String(next?.folio || "").trim(),
    category: String(next?.category || "").trim(),
    issueDate: String(next?.issueDate || "").trim(),
    dueDate: String(next?.dueDate || "").trim(),
    status: String(next?.status || "Pendiente").trim() || "Pendiente",
    total: Number.isFinite(total) ? total : 0,
    pdfName: String(next?.pdfName || "").trim(),
    pdfUrl: String(next?.pdfUrl || "").trim(),
    notes: String(next?.notes || "").trim(),
  };
}

function sanitizeTreasuryPurchaseOrder(next = {}, empId = "") {
  const amount = Number(next?.amount || 0);
  return {
    ...next,
    id: String(next?.id || "").trim(),
    empId: String(next?.empId || empId || "").trim(),
    clientId: String(next?.clientId || "").trim(),
    number: String(next?.number || "").trim(),
    issueDate: String(next?.issueDate || "").trim(),
    status: String(next?.status || "Pendiente").trim() || "Pendiente",
    amount: Number.isFinite(amount) ? amount : 0,
    linkedInvoiceIds: Array.isArray(next?.linkedInvoiceIds) ? next.linkedInvoiceIds.filter(Boolean) : [],
  };
}

function sanitizeTreasuryIssuedOrder(next = {}, empId = "") {
  const amount = Number(next?.amount || 0);
  const items = Array.isArray(next?.items) ? next.items : [];
  return {
    ...next,
    id: String(next?.id || "").trim(),
    empId: String(next?.empId || empId || "").trim(),
    supplier: String(next?.supplier || "").trim(),
    number: String(next?.number || "").trim(),
    issueDate: String(next?.issueDate || "").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    items,
  };
}

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
  const payablesRemoteHydratedRef = useRef("");
  const receiptsRemoteHydratedRef = useRef("");
  const disbursementsRemoteHydratedRef = useRef("");
  const purchaseOrdersRemoteHydratedRef = useRef("");
  const issuedOrdersRemoteHydratedRef = useRef("");
  const foundationFinancialRegistry = useMemo(() => createFoundationFinancialRegistryCoordinator({
    empId,
    platformServices,
    actor: currentUser,
  }), [empId, platformServices, currentUser]);

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

  useEffect(() => {
    payablesRemoteHydratedRef.current = "";
    receiptsRemoteHydratedRef.current = "";
    disbursementsRemoteHydratedRef.current = "";
    purchaseOrdersRemoteHydratedRef.current = "";
    issuedOrdersRemoteHydratedRef.current = "";
  }, [empId]);

  useEffect(() => {
    let alive = true;
    foundationFinancialRegistry.rehydrateSnapshot({
      registryName: "payables",
      hydratedRef: payablesRemoteHydratedRef,
      currentRecords: treasuryPayables,
      setRecords: setTreasuryPayables,
      sanitizeRecord: sanitizeTreasuryPayable,
      isValidRecord: item => item.id && item.supplier && item.total >= 0,
      mergeRecords: mergeById,
      failureMessage: "No pudimos rehidratar payables desde foundation.",
    }).then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [foundationFinancialRegistry, setTreasuryPayables, treasuryPayables]);

  useEffect(() => {
    let alive = true;
    foundationFinancialRegistry.rehydrateSnapshot({
      registryName: "receipts",
      hydratedRef: receiptsRemoteHydratedRef,
      currentRecords: treasuryReceipts,
      setRecords: setTreasuryReceipts,
      sanitizeRecord: sanitizeTreasuryReceipt,
      isValidRecord: item => item.id && item.invoiceId,
      mergeRecords: mergeById,
      failureMessage: "No pudimos rehidratar receipts desde foundation.",
    }).then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [foundationFinancialRegistry, setTreasuryReceipts, treasuryReceipts]);

  useEffect(() => {
    let alive = true;
    foundationFinancialRegistry.rehydrateSnapshot({
      registryName: "disbursements",
      hydratedRef: disbursementsRemoteHydratedRef,
      currentRecords: treasuryDisbursements,
      setRecords: setTreasuryDisbursements,
      sanitizeRecord: sanitizeTreasuryDisbursement,
      isValidRecord: item => item.id && item.payableId,
      mergeRecords: mergeById,
      failureMessage: "No pudimos rehidratar disbursements desde foundation.",
    }).then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [foundationFinancialRegistry, setTreasuryDisbursements, treasuryDisbursements]);

  useEffect(() => {
    let alive = true;
    foundationFinancialRegistry.rehydrateSnapshot({
      registryName: "purchase_orders",
      hydratedRef: purchaseOrdersRemoteHydratedRef,
      currentRecords: treasuryPurchaseOrders,
      setRecords: setTreasuryPurchaseOrders,
      sanitizeRecord: sanitizeTreasuryPurchaseOrder,
      isValidRecord: item => item.id && item.clientId && item.number,
      mergeRecords: mergeById,
      failureMessage: "No pudimos rehidratar purchase orders desde foundation.",
    }).then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [foundationFinancialRegistry, setTreasuryPurchaseOrders, treasuryPurchaseOrders]);

  useEffect(() => {
    let alive = true;
    foundationFinancialRegistry.rehydrateSnapshot({
      registryName: "issued_orders",
      hydratedRef: issuedOrdersRemoteHydratedRef,
      currentRecords: treasuryIssuedOrders,
      setRecords: setTreasuryIssuedOrders,
      sanitizeRecord: sanitizeTreasuryIssuedOrder,
      isValidRecord: item => item.id && item.number,
      mergeRecords: mergeById,
      failureMessage: "No pudimos rehidratar issued orders desde foundation.",
    }).then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [foundationFinancialRegistry, setTreasuryIssuedOrders, treasuryIssuedOrders]);

  const savePayable = async next => {
    if (!canManageTreasury) return false;
    if (!empId) return false;
    const safeNext = sanitizeTreasuryPayable(withEmp(next), empId);
    const exists = treasuryPayables.some(item => item.id === safeNext.id);
    const updated = mergeById(treasuryPayables, [safeNext]);
    await setTreasuryPayables?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "payables",
      records: updated,
      metadata: {
        reason: exists ? "payable_updated" : "payable_created",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar payables con foundation.",
    });
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
    const updated = treasuryPayables.filter(item => item.id !== id);
    await setTreasuryPayables?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "payables",
      records: updated,
      metadata: {
        reason: "payable_deleted",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar payables con foundation.",
    });
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
    const safeNext = sanitizeTreasuryPurchaseOrder(withEmp(next), empId);
    const exists = treasuryPurchaseOrders.some(item => item.id === safeNext.id);
    const updated = mergeById(treasuryPurchaseOrders, [safeNext]);
    await setTreasuryPurchaseOrders?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "purchase_orders",
      records: updated,
      metadata: {
        reason: exists ? "purchase_order_updated" : "purchase_order_created",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar purchase orders con foundation.",
    });
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
    const updated = treasuryPurchaseOrders.filter(item => item.id !== id);
    await setTreasuryPurchaseOrders?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "purchase_orders",
      records: updated,
      metadata: {
        reason: "purchase_order_deleted",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar purchase orders con foundation.",
    });
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
    const safeNext = sanitizeTreasuryIssuedOrder(withEmp(next), empId);
    const exists = treasuryIssuedOrders.some(item => item.id === safeNext.id);
    const updated = mergeById(treasuryIssuedOrders, [safeNext]);
    await setTreasuryIssuedOrders?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "issued_orders",
      records: updated,
      metadata: {
        reason: exists ? "issued_order_updated" : "issued_order_created",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar issued orders con foundation.",
    });
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
    const updated = treasuryIssuedOrders.filter(item => item.id !== id);
    await setTreasuryIssuedOrders?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "issued_orders",
      records: updated,
      metadata: {
        reason: "issued_order_deleted",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar issued orders con foundation.",
    });
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
    const safeNext = sanitizeTreasuryReceipt({ ...next, empId }, empId);
    const nextAmount = Number(safeNext.amount || 0);
    const maxAmount = Number(next.maxAmount || 0);
    if (!nextAmount || nextAmount <= 0) return false;
    if (maxAmount > 0 && nextAmount > maxAmount) return false;
    if (!safeNext.id || !safeNext.invoiceId) return false;
    const exists = treasuryReceipts.some(item => item.id === safeNext.id);
    const updated = mergeById(treasuryReceipts, [{ ...safeNext, amount: nextAmount }]);
    await setTreasuryReceipts?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "receipts",
      records: updated,
      metadata: {
        reason: exists ? "receipt_updated" : "receipt_created",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar receipts con foundation.",
    });
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
    const safeNext = sanitizeTreasuryDisbursement({ ...next, empId }, empId);
    const nextAmount = Number(safeNext.amount || 0);
    const maxAmount = Number(next.maxAmount || 0);
    if (!nextAmount || nextAmount <= 0) return false;
    if (maxAmount > 0 && nextAmount > maxAmount) return false;
    if (!safeNext.id || !safeNext.payableId) return false;
    const baseDisbursements = Array.isArray(treasuryDisbursements) ? treasuryDisbursements : effectiveTreasuryDisbursements;
    const exists = baseDisbursements.some(item => item.id === safeNext.id);
    const updated = mergeById(baseDisbursements, [{ ...safeNext, amount: nextAmount }]);
    await setTreasuryDisbursements?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "disbursements",
      records: updated,
      metadata: {
        reason: exists ? "disbursement_updated" : "disbursement_created",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar disbursements con foundation.",
    });
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
    const updated = (Array.isArray(treasuryReceipts) ? treasuryReceipts : []).filter(item => item.id !== id);
    await setTreasuryReceipts?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "receipts",
      records: updated,
      metadata: {
        reason: "receipt_deleted",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar receipts con foundation.",
    });
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
    const baseDisbursements = Array.isArray(treasuryDisbursements) && treasuryDisbursements.length
      ? treasuryDisbursements
      : effectiveTreasuryDisbursements;
    const updated = baseDisbursements.filter(item => item.id !== id);
    await setTreasuryDisbursements?.(updated);
    await foundationFinancialRegistry.syncSnapshot({
      registryName: "disbursements",
      records: updated,
      metadata: {
        reason: "disbursement_deleted",
        actorUserId: currentUser?.id || "",
        actorUserEmail: currentUser?.email || "",
      },
      degradedMessage: "No pudimos sincronizar disbursements con foundation.",
    });
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
