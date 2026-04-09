import { useMemo, useState } from "react";

export function useLabBudgetDetail({
  id,
  empresa,
  presupuestos,
  clientes,
  contratos,
  facturas,
  producciones,
  programas,
  setPresupuestos,
  setProducciones,
  setProgramas,
  setMovimientos,
  cSave,
  today,
  uid,
  hasAddon,
  canDo,
}) {
  const empId = empresa?.id;
  const p = useMemo(() => (presupuestos || []).find((x) => x.id === id), [id, presupuestos]);
  const c = useMemo(() => (clientes || []).find((x) => x.id === p?.cliId), [clientes, p?.cliId]);
  const contrato = useMemo(() => (contratos || []).find((ct) => ct.id === p?.contratoId), [contratos, p?.contratoId]);
  const linkedInvoices = useMemo(() => (facturas || []).filter((f) => f.presupuestoId === p?.id), [facturas, p?.id]);
  const canPrograms = hasAddon(empresa, "television");
  const canContracts = hasAddon(empresa, "contratos");
  const canInvoices = hasAddon(empresa, "facturacion");
  const canEditBudgets = !!(canDo && canDo("presupuestos"));
  const canCreateProjects = !!(canDo && canDo("producciones"));
  const canCreatePrograms = !!(canDo && canDo("programas"));
  const canCreateMovements = !!(canDo && canDo("movimientos"));
  const [convOpen, setConvOpen] = useState(false);
  const [convTipo, setConvTipo] = useState("produccion");
  const [convNom, setConvNom] = useState(p?.titulo || "");
  const [itemSort, setItemSort] = useState("desc-asc");

  const setEstadoPres = (estado) => {
    if (!canEditBudgets) return;
    cSave(presupuestos, setPresupuestos, { ...p, estado });
  };

  const convertir = async (navTo) => {
    if (!canEditBudgets) return;
    if (!convNom.trim() || !p) return;
    if (convTipo === "produccion" && !canCreateProjects) return;
    if (convTipo === "programa" && !canCreatePrograms) return;
    const newId = uid();
    if (convTipo === "produccion") {
      const nuevo = { id: newId, empId, nom: convNom, cliId: p.cliId, tip: "Contenido Audiovisual", est: "Pre-Producción", ini: today(), fin: "", des: p.titulo, crewIds: [] };
      await setProducciones([...(producciones || []), nuevo]);
    } else {
      const nuevo = { id: newId, empId, nom: convNom, tip: "Producción", can: "", est: "En Desarrollo", totalEp: "", fre: "Semanal", temporada: "", conductor: "", prodEjec: "", des: p.titulo, cliId: p.cliId || "", crewIds: [] };
      await setProgramas([...(programas || []), nuevo]);
    }
    if (p.total && canCreateMovements) {
      const ingresoAuto = { id: uid(), empId, eid: newId, et: convTipo === "produccion" ? "pro" : "pg", tipo: "ingreso", cat: "Producción", desc: `Ingreso desde presupuesto: ${p.titulo}`, monto: p.total, fecha: today() };
      await setMovimientos((prev) => [...(prev || []), ingresoAuto]);
    }
    await cSave(presupuestos, setPresupuestos, { ...p, convertido: convTipo, convertidoNom: convNom });
    setConvOpen(false);
    navTo(convTipo === "produccion" ? "producciones" : "programas");
  };

  const sortedItems = useMemo(() => ([...(p?.items || [])].sort((a, b) => {
    if (itemSort === "desc-desc") return String(b.desc || "").localeCompare(String(a.desc || ""));
    if (itemSort === "qty-desc") return Number(b.qty || 0) - Number(a.qty || 0);
    if (itemSort === "qty-asc") return Number(a.qty || 0) - Number(b.qty || 0);
    if (itemSort === "price-desc") return Number(b.precio || 0) - Number(a.precio || 0);
    if (itemSort === "price-asc") return Number(a.precio || 0) - Number(b.precio || 0);
    if (itemSort === "total-desc") return Number(b.qty || 0) * Number(b.precio || 0) - Number(a.qty || 0) * Number(a.precio || 0);
    if (itemSort === "total-asc") return Number(a.qty || 0) * Number(a.precio || 0) - Number(b.qty || 0) * Number(b.precio || 0);
    return String(a.desc || "").localeCompare(String(b.desc || ""));
  })), [itemSort, p?.items]);

  return {
    empId,
    p,
    c,
    contrato,
    linkedInvoices,
    canPrograms,
    canContracts,
    canInvoices,
    canEditBudgets,
    canCreateProjects,
    canCreatePrograms,
    convOpen,
    setConvOpen,
    convTipo,
    setConvTipo,
    convNom,
    setConvNom,
    itemSort,
    setItemSort,
    setEstadoPres,
    convertir,
    sortedItems,
  };
}
