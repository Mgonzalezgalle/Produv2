import { useMemo, useState } from "react";

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

  const sortDocs = (arr = []) => [...arr].sort((a, b) => {
    if (sortMode === "az") return invoiceEntityName(a, clientes, auspiciadores).localeCompare(invoiceEntityName(b, clientes, auspiciadores));
    if (sortMode === "za") return invoiceEntityName(b, clientes, auspiciadores).localeCompare(invoiceEntityName(a, clientes, auspiciadores));
    if (sortMode === "amount-desc") return Number(b.total || 0) - Number(a.total || 0);
    if (sortMode === "amount-asc") return Number(a.total || 0) - Number(b.total || 0);
    if (sortMode === "oldest") return String(a.fechaEmision || a.cr || "").localeCompare(String(b.fechaEmision || b.cr || ""));
    return String(b.fechaEmision || b.cr || "").localeCompare(String(a.fechaEmision || a.cr || ""));
  });

  const fd = useMemo(() => sortDocs(
    allDocs.filter((f) => {
      const ent = invoiceEntityName(f, clientes, auspiciadores);
      return (ent.toLowerCase().includes(q.toLowerCase()) || (f.correlativo || "").toLowerCase().includes(q.toLowerCase()))
        && (!fe || f.estado === fe);
    })
  ), [allDocs, clientes, auspiciadores, fe, invoiceEntityName, q, sortMode]);

  const cobranzaDocs = useMemo(() => sortDocs(
    (invoices || []).filter((f) => {
      const ent = invoiceEntityName(f, clientes, auspiciadores);
      return (ent.toLowerCase().includes(q.toLowerCase()) || (f.correlativo || "").toLowerCase().includes(q.toLowerCase()))
        && (!fc || cobranzaState(f) === fc);
    })
  ), [invoices, clientes, auspiciadores, cobranzaState, fc, invoiceEntityName, q, sortMode]);

  const currentPageIds = useMemo(
    () => (tab === 1 ? cobranzaDocs : fd).slice((pg - 1) * PP, pg * PP).map((item) => item.id),
    [cobranzaDocs, fd, pg, tab],
  );

  const toggleSelected = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = (checked) => setSelectedIds(checked ? currentPageIds : []);

  const cuentasPorCobrar = useMemo(() => (invoices || []).filter((f) => cobranzaState(f) !== "Pagado"), [cobranzaState, invoices]);
  const pendiente = cuentasPorCobrar.reduce((s, f) => s + Number(f.total || 0), 0);
  const pagado = (invoices || []).filter((f) => cobranzaState(f) === "Pagado").reduce((s, f) => s + Number(f.total || 0), 0);
  const vencidas = (invoices || []).filter((f) => cobranzaState(f) === "Retrasado de pago").length;
  const emitidas = fd.filter((f) => f.estado === "Emitida").length;
  const recurrentes = fd.filter((f) => f.recurring).length;

  const applyBulkEstado = () => {
    if (!canEdit) return false;
    if (!bulkEstado) return;
    setFacturas((facturas || []).map((item) => (selectedIds.includes(item.id) ? { ...item, estado: bulkEstado } : item)));
    setSelectedIds([]);
  };

  const deleteSelected = () => {
    if (!canEdit) return false;
    if (!confirm(`¿Eliminar ${selectedIds.length} documento${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`)) return;
    const removedIds = [...selectedIds];
    setFacturas((facturas || []).filter((item) => !removedIds.includes(item.id)));
    setMovimientos((Array.isArray(movimientos) ? movimientos : []).filter((m) => !removedIds.includes(m.facturaId)));
    setSelectedIds([]);
  };

  const applyBulkCobranza = () => {
    if (!canEdit) return false;
    if (!bulkCobranza) return;
    setFacturas((facturas || []).map((item) => (
      selectedIds.includes(item.id)
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
