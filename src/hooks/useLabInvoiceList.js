import { useCallback, useMemo, useState } from "react";
import {
  requiresProduCollectionTracking,
  resolveProduBillingDocumentType,
} from "../lib/integrations/billingDomain";
import { requestConfirm } from "../lib/ui/confirmService";

export function useLabInvoiceList({
  empresa,
  facturas,
  movimientos,
  invoices,
  clientes,
  auspiciadores,
  canEdit = false,
  setFacturas,
  setMovimientos,
  invoiceEntityName,
  cobranzaState,
  today,
}) {
  const empId = empresa?.id;
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const [fe, setFe] = useState("");
  const [fc, setFc] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [bulkCobranza, setBulkCobranza] = useState("");
  const [pg, setPg] = useState(1);
  const PP = 10;

  const allDocs = useMemo(() => (facturas || []).filter((x) => x.empId === empId), [empId, facturas]);

  const sortDocs = useCallback((arr = []) => [...arr].sort((a, b) => {
    if (sortMode === "az") return invoiceEntityName(a, clientes, auspiciadores).localeCompare(invoiceEntityName(b, clientes, auspiciadores));
    if (sortMode === "za") return invoiceEntityName(b, clientes, auspiciadores).localeCompare(invoiceEntityName(a, clientes, auspiciadores));
    if (sortMode === "amount-desc") return Number(b.total || 0) - Number(a.total || 0);
    if (sortMode === "amount-asc") return Number(a.total || 0) - Number(b.total || 0);
    if (sortMode === "oldest") return String(a.fechaEmision || a.cr || "").localeCompare(String(b.fechaEmision || b.cr || ""));
    return String(b.fechaEmision || b.cr || "").localeCompare(String(a.fechaEmision || a.cr || ""));
  }), [auspiciadores, clientes, invoiceEntityName, sortMode]);

  const fd = useMemo(() => sortDocs(
    allDocs.filter((f) => {
      const ent = invoiceEntityName(f, clientes, auspiciadores);
      return (ent.toLowerCase().includes(q.toLowerCase()) || (f.correlativo || "").toLowerCase().includes(q.toLowerCase()))
        && (!fe || f.estado === fe);
    })
  ), [allDocs, clientes, auspiciadores, fe, invoiceEntityName, q, sortDocs]);

  const cobranzaDocs = useMemo(() => sortDocs(
    (invoices || []).filter((f) => {
      const ent = invoiceEntityName(f, clientes, auspiciadores);
      return (ent.toLowerCase().includes(q.toLowerCase()) || (f.correlativo || "").toLowerCase().includes(q.toLowerCase()))
        && (!fc || cobranzaState(f) === fc);
    })
  ), [invoices, clientes, auspiciadores, cobranzaState, fc, invoiceEntityName, q, sortDocs]);

  const currentPageIds = useMemo(
    () => (tab === 1 ? cobranzaDocs : fd).slice((pg - 1) * PP, pg * PP).map((item) => item.id),
    [cobranzaDocs, fd, pg, tab],
  );

  const isProtectedElectronicDocument = (item) => !!item?.externalSync;
  const supportsCollectionTracking = (item) => requiresProduCollectionTracking(
    resolveProduBillingDocumentType(item?.documentTypeCode || item?.tipoDocumento || item?.tipoDoc || "factura_afecta")?.code,
  );
  const currentPageDocs = useMemo(
    () => (tab === 1 ? cobranzaDocs : fd).slice((pg - 1) * PP, pg * PP),
    [cobranzaDocs, fd, pg, tab],
  );
  const selectablePageIds = useMemo(
    () => currentPageDocs
      .filter((item) => (tab === 1 ? supportsCollectionTracking(item) : !isProtectedElectronicDocument(item)))
      .map((item) => item.id),
    [currentPageDocs, tab],
  );

  const toggleSelected = (id) => {
    const sourceList = tab === 1 ? cobranzaDocs : fd;
    const target = sourceList.find((item) => item.id === id);
    if (!target) return;
    if (tab === 1 ? !supportsCollectionTracking(target) : isProtectedElectronicDocument(target)) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleAll = (checked) => setSelectedIds(checked ? selectablePageIds : []);

  const cuentasPorCobrar = useMemo(() => (invoices || []).filter((f) => cobranzaState(f) !== "Pagado"), [cobranzaState, invoices]);
  const pendiente = cuentasPorCobrar.reduce((s, f) => s + Number(f.total || 0), 0);
  const pagado = (invoices || []).filter((f) => cobranzaState(f) === "Pagado").reduce((s, f) => s + Number(f.total || 0), 0);
  const vencidas = (invoices || []).filter((f) => cobranzaState(f) === "Retrasado de pago").length;
  const emitidas = fd.filter((f) => f.estado === "Emitida").length;
  const recurrentes = fd.filter((f) => f.recurring).length;

  const applyBulkEstado = () => {
    if (!canEdit) return false;
    if (!bulkEstado) return;
    setFacturas((facturas || []).map((item) => (
      selectedIds.includes(item.id) && !isProtectedElectronicDocument(item)
        ? { ...item, estado: bulkEstado }
        : item
    )));
    setSelectedIds([]);
  };

  const deleteSelected = async () => {
    if (!canEdit) return false;
    const confirmed = await requestConfirm({
      title: "Eliminar documentos",
      message: `¿Eliminar ${selectedIds.length} documento${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`,
      confirmLabel: "Eliminar",
    });
    if (!confirmed) return;
    const removableIds = new Set(
      (facturas || [])
        .filter((item) => selectedIds.includes(item.id) && !isProtectedElectronicDocument(item))
        .map((item) => item.id),
    );
    setFacturas((facturas || []).filter((item) => !removableIds.has(item.id)));
    setMovimientos((Array.isArray(movimientos) ? movimientos : []).filter((m) => !removableIds.has(m.facturaId)));
    setSelectedIds([]);
  };

  const applyBulkCobranza = () => {
    if (!canEdit) return false;
    if (!bulkCobranza) return;
    setFacturas((facturas || []).map((item) => (
      selectedIds.includes(item.id) && supportsCollectionTracking(item)
        ? { ...item, cobranzaEstado: bulkCobranza, fechaPago: bulkCobranza === "Pagado" ? (item.fechaPago || today()) : "" }
        : item
    )));
    setSelectedIds([]);
  };

  return {
    tab,
    setTab,
    q,
    setQ,
    fe,
    setFe,
    fc,
    setFc,
    sortMode,
    setSortMode,
    selectedIds,
    setSelectedIds,
    bulkEstado,
    setBulkEstado,
    bulkCobranza,
    setBulkCobranza,
    pg,
    setPg,
    PP,
    fd,
    cobranzaDocs,
    currentPageIds,
    selectablePageIds,
    toggleSelected,
    toggleAll,
    cuentasPorCobrar,
    pendiente,
    pagado,
    vencidas,
    emitidas,
    recurrentes,
    applyBulkEstado,
    deleteSelected,
    applyBulkCobranza,
  };
}
