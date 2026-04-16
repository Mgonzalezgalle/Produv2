import { useMemo, useState } from "react";
import { requestConfirm } from "../lib/ui/confirmService";

export function useLabBudgetList({
  empresa,
  presupuestos,
  setPresupuestos,
  cSave,
  canEdit,
}) {
  const empId = empresa?.id;
  const [q, setQ] = useState("");
  const [fe, setFe] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [pg, setPg] = useState(1);
  const PP = 10;

  const filtered = useMemo(() => (
    (presupuestos || [])
      .filter((x) => x.empId === empId)
      .filter((p) => (p.titulo || "").toLowerCase().includes(q.toLowerCase()) && (!fe || p.estado === fe))
      .sort((a, b) => {
        if (sortMode === "az") return String(a.titulo || "").localeCompare(String(b.titulo || ""));
        if (sortMode === "za") return String(b.titulo || "").localeCompare(String(a.titulo || ""));
        if (sortMode === "oldest") return String(a.cr || "").localeCompare(String(b.cr || ""));
        return String(b.cr || "").localeCompare(String(a.cr || ""));
      })
  ), [empId, fe, presupuestos, q, sortMode]);

  const total = filtered.reduce((s, p) => s + Number(p.total || 0), 0);
  const aceptados = filtered.filter((p) => p.estado === "Aceptado").reduce((s, p) => s + Number(p.total || 0), 0);
  const acceptedCount = filtered.filter((p) => p.estado === "Aceptado").length;

  const setEstadoRapido = (evt, pres, estado) => {
    if (!canEdit) return;
    evt.stopPropagation();
    cSave(presupuestos, setPresupuestos, { ...pres, estado });
  };

  const toggleSelected = (id) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const currentPage = filtered.slice((pg - 1) * PP, pg * PP);
  const toggleAll = (checked) => setSelectedIds(checked ? currentPage.map((item) => item.id) : []);

  const applyBulkEstado = () => {
    if (!canEdit) return;
    if (!bulkEstado) return;
    setPresupuestos((presupuestos || []).map((item) => (selectedIds.includes(item.id) ? { ...item, estado: bulkEstado } : item)));
    setSelectedIds([]);
  };

  const deleteSelected = async () => {
    if (!canEdit) return;
    const confirmed = await requestConfirm({
      title: "Eliminar presupuestos",
      message: `¿Eliminar ${selectedIds.length} presupuesto${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`,
      confirmLabel: "Eliminar",
    });
    if (!confirmed) return;
    setPresupuestos((presupuestos || []).filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

  return {
    q,
    setQ,
    fe,
    setFe,
    sortMode,
    setSortMode,
    selectedIds,
    setSelectedIds,
    bulkEstado,
    setBulkEstado,
    pg,
    setPg,
    PP,
    filtered,
    total,
    aceptados,
    acceptedCount,
    setEstadoRapido,
    toggleSelected,
    toggleAll,
    currentPage,
    applyBulkEstado,
    deleteSelected,
  };
}
