import { useEffect, useState } from "react";
import {
  crmActivityEntry,
  crmFindClientDuplicate,
  crmFindSponsorDuplicate,
  crmNormalizeActivities,
  crmNormalizeOpportunity,
  crmStageMeta,
  normalizeCrmStages,
  recoverPreferredCrmStages,
} from "../lib/utils/crm";
import { requestConfirm } from "../lib/ui/confirmService";

const uid = () => "_" + Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().split("T")[0];

export function useLabCrmModule({
  empresa,
  user,
  crmOpps,
  crmActivities,
  crmStages,
  clientes,
  auspiciadores,
  tareas,
  users,
  ntf,
  setClientes,
  setAuspiciadores,
  setCrmOpps,
  setCrmActivities,
  setCrmStages,
  setTareas,
  crmSavingRef,
  fmtD,
  canDo,
}) {
  const empId = empresa?.id;
  const isMobile = typeof window !== "undefined" ? window.innerWidth <= 768 : false;
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [nextActionFilter, setNextActionFilter] = useState("");
  const [sortKey, setSortKey] = useState("updated");
  const [pg, setPg] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkResponsible, setBulkResponsible] = useState("");
  const [bulkTipoNegocio, setBulkTipoNegocio] = useState("");
  const [detailId, setDetailId] = useState("");
  const [stagesOpen, setStagesOpen] = useState(false);
  const [localStages, setLocalStages] = useState(null);
  const [stagesChanged, setStagesChanged] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: "note", text: "" });
  const [mobileStageId, setMobileStageId] = useState("");
  const [collapsedStages, setCollapsedStages] = useState([]);
  const PP = 10;
  const tasksEnabled = Array.isArray(empresa?.addons) && empresa.addons.includes("tareas");
  const canManageCrm = !!(canDo && canDo("crm"));
  const canManageTasks = !!(canDo && canDo("tareas"));
  const scopedStages = normalizeCrmStages(crmStages || []);
  const scopedOpps = (crmOpps || []).filter(opp => opp.empId === empId).map(opp => crmNormalizeOpportunity(opp, scopedStages));
  const scopedActivities = crmNormalizeActivities((crmActivities || []).filter(act => act.empId === empId));
  const tenantUsers = (users || []).filter(u => u.empId === empId && u.active !== false);

  const shiftIsoDate = (dateStr, days = 0) => {
    if (!dateStr) return "";
    const base = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(base.getTime())) return dateStr;
    base.setDate(base.getDate() + days);
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, "0");
    const d = String(base.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const todayStr = today();
  const weekAhead = shiftIsoDate(todayStr, 7);
  const matchNextActionFilter = opp => {
    const dt = opp.nextActionDate || "";
    if (!nextActionFilter) return true;
    if (nextActionFilter === "overdue") return !!dt && dt < todayStr;
    if (nextActionFilter === "today") return dt === todayStr;
    if (nextActionFilter === "week") return !!dt && dt >= todayStr && dt <= weekAhead;
    if (nextActionFilter === "scheduled") return !!dt;
    if (nextActionFilter === "none") return !dt;
    return true;
  };
  const nextActionTone = opp => {
    const dt = opp?.nextActionDate || "";
    if (!dt) return { color: "var(--gr2)", badge: "gray", label: "Sin fecha" };
    if (dt < todayStr) return { color: "#ff5566", badge: "red", label: "Vencida" };
    if (dt === todayStr) return { color: "#ffcc44", badge: "yellow", label: "Hoy" };
    if (dt <= weekAhead) return { color: "var(--cy)", badge: "cyan", label: "Esta semana" };
    return { color: "#00e08a", badge: "green", label: "Programada" };
  };
  const filtered = scopedOpps.filter(opp => {
    const haystack = [opp.nombre, opp.empresaMarca, opp.contacto, opp.email, opp.telefono].join(" ").toLowerCase();
    return (!q || haystack.includes(q.toLowerCase()))
      && (!tipo || opp.tipo_negocio === tipo)
      && (!estado || opp.status === estado)
      && (!stageFilter || opp.stageId === stageFilter)
      && matchNextActionFilter(opp);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "amount") return Number(b.monto_estimado || 0) - Number(a.monto_estimado || 0);
    if (sortKey === "close") return String(a.fecha_cierre_estimada || "9999-12-31").localeCompare(String(b.fecha_cierre_estimada || "9999-12-31"));
    if (sortKey === "name") return String(a.nombre || "").localeCompare(String(b.nombre || ""));
    return String(b.convertedAt || b.updatedAt || b.createdAt || "").localeCompare(String(a.convertedAt || a.updatedAt || a.createdAt || ""));
  });
  const paged = sorted.slice((pg - 1) * PP, pg * PP);
  const selectedItems = scopedOpps.filter(opp => selectedIds.includes(opp.id));
  const detail = scopedOpps.find(opp => opp.id === detailId) || null;
  const detailActivities = scopedActivities.filter(act => act.opportunityId === detailId).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const detailTasks = tasksEnabled ? (Array.isArray(tareas) ? tareas : []).filter(t => t?.empId === empId && t.refTipo === "crm" && t.refId === detailId) : [];
  const stagesById = Object.fromEntries(scopedStages.map(stage => [stage.id, stage]));
  const activeMobileStageId = mobileStageId || scopedStages[0]?.id || "";
  const mobileStage = scopedStages.find(stage => stage.id === activeMobileStageId) || scopedStages[0];
  const mobileStageItems = sorted.filter(opp => opp.stageId === activeMobileStageId);
  const hasTenant = Boolean(empId);

  useEffect(() => {
    if (!mobileStageId && scopedStages[0]?.id) setMobileStageId(scopedStages[0].id);
    if (mobileStageId && !scopedStages.some(stage => stage.id === mobileStageId)) setMobileStageId(scopedStages[0]?.id || "");
  }, [mobileStageId, scopedStages]);

  const persistOpps = async next => {
    if (!hasTenant || !canManageCrm) return false;
    await setCrmOpps(next.map(opp => crmNormalizeOpportunity({ ...opp, empId }, scopedStages)));
    return true;
  };
  const addActivity = async (oppId, text, type = "note", extra = {}) => {
    if (!hasTenant || !canManageCrm || !text?.trim()) return false;
    await setCrmActivities([...(crmActivities || []), crmActivityEntry(oppId, text.trim(), type, user, empId, extra)]);
    return true;
  };
  const saveOpp = async (opp, activityText = "", activityType = "update") => {
    if (!hasTenant || !canManageCrm) return null;
    const nextOpp = crmNormalizeOpportunity({ ...opp, empId }, scopedStages);
    const exists = scopedOpps.some(item => item.id === nextOpp.id);
    const nextList = exists ? (crmOpps || []).map(item => item.id === nextOpp.id ? nextOpp : item) : [...(crmOpps || []), nextOpp];
    await persistOpps(nextList);
    if (activityText) await addActivity(nextOpp.id, activityText, activityType);
    return nextOpp;
  };
  const updateStage = async (opp, stageId) => {
    if (!canManageCrm) return;
    const stage = crmStageMeta(stageId, scopedStages);
    const nextStatus = stage.closedWon ? "Ganada" : stage.closedLost ? "Perdida" : (opp.status === "Ganada" || opp.status === "Perdida" ? "Activa" : opp.status || "Activa");
    await saveOpp({ ...opp, stageId, status: nextStatus }, `Etapa actualizada a ${stage.name}.`, "stage");
    ntf?.("Etapa actualizada ✓");
  };
  const updateQuickField = async (opp, key, value, label) => {
    if (!canManageCrm) return;
    await saveOpp({ ...opp, [key]: value }, `${label} actualizado.`, "update");
  };
  const passToEntity = async opp => {
    if (!hasTenant || !canManageCrm) return;
    const stageWon = scopedStages.find(stage => stage.closedWon) || scopedStages.find(stage => stage.convertToClient) || scopedStages[0];
    if (opp.tipo_negocio === "auspiciador") {
      const existing = crmFindSponsorDuplicate((auspiciadores || []).filter(a => a.empId === empId), opp);
      const sponsorId = existing?.id || uid();
      if (!existing) {
        const newSponsor = {
          id: sponsorId,
          empId,
          nom: opp.empresaMarca || opp.nombre,
          tip: "Auspiciador Principal",
          con: opp.contacto || "",
          ema: opp.email || "",
          tel: opp.telefono || "",
          pids: [],
          mon: String(Number(opp.monto_estimado || 0) || ""),
          vig: opp.fecha_cierre_estimada || "",
          est: "Negociación",
          frecPago: "Mensual",
          not: `Creado desde CRM el ${fmtD(today())} a partir de la oportunidad ${opp.nombre}.`,
          crmOpportunityId: opp.id,
        };
        await setAuspiciadores([...(auspiciadores || []), newSponsor]);
      }
      await saveOpp({ ...opp, linkedSponsorId: sponsorId, convertedAt: today(), convertedBy: user?.name || "", status: "Ganada", stageId: stageWon?.id || opp.stageId }, `Oportunidad vinculada al módulo de Auspiciadores${existing ? " (auspiciador existente)." : "."}`, "conversion");
      ntf?.(existing ? "Vinculado a auspiciador existente ✓" : "Auspiciador creado desde CRM ✓");
      return;
    }
    const existing = crmFindClientDuplicate((clientes || []).filter(c => c.empId === empId), opp);
    const clientId = existing?.id || uid();
    if (!existing) {
      const newClient = {
        id: clientId,
        empId,
        nom: opp.empresaMarca || opp.nombre,
        rut: "",
        ind: "Prospecto comercial",
        dir: "",
        not: `Creado desde CRM el ${fmtD(today())} a partir de la oportunidad ${opp.nombre}.`,
        crmOpportunityId: opp.id,
        contactos: [{
          id: uid(),
          nom: opp.contacto || opp.empresaMarca || opp.nombre,
          car: "",
          ema: opp.email || "",
          tel: opp.telefono || "",
          not: "Contacto originado desde CRM",
        }],
      };
      await setClientes([...(clientes || []), newClient]);
    }
    await saveOpp({ ...opp, linkedClientId: clientId, convertedAt: today(), convertedBy: user?.name || "", status: "Ganada", stageId: stageWon?.id || opp.stageId }, `Oportunidad vinculada al módulo de Clientes${existing ? " (cliente existente)." : "."}`, "conversion");
    ntf?.(existing ? "Vinculado a cliente existente ✓" : "Cliente creado desde CRM ✓");
  };
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleStageCollapsed = stageId => setCollapsedStages(prev => prev.includes(stageId) ? prev.filter(id => id !== stageId) : [...prev, stageId]);
  const toggleAllVisible = () => setSelectedIds(prev => {
    const pageIds = paged.map(item => item.id);
    const allSelected = pageIds.every(id => prev.includes(id));
    return allSelected ? prev.filter(id => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])];
  });
  const exportTarget = selectedItems.length ? selectedItems : sorted;
  const clearSelection = () => {
    setSelectedIds([]);
    setBulkResponsible("");
    setBulkTipoNegocio("");
  };
  const bulkAssignTipoNegocio = async () => {
    if (!canManageCrm || !selectedItems.length || !bulkTipoNegocio) return;
    const nextOpps = (crmOpps || []).map(opp =>
      opp.empId === empId && selectedIds.includes(opp.id)
        ? crmNormalizeOpportunity({ ...opp, tipo_negocio: bulkTipoNegocio, updatedAt: today() }, scopedStages)
        : opp,
    );
    await setCrmOpps(nextOpps);
    await setCrmActivities([
      ...(crmActivities || []),
      ...selectedItems.map(opp => crmActivityEntry(opp.id, `Tipo de negocio actualizado en lote a ${bulkTipoNegocio === "auspiciador" ? "Auspiciador" : "Cliente"}.`, "update", user, empId)),
    ]);
    ntf?.(`Tipo de negocio actualizado en ${selectedItems.length} oportunidad${selectedItems.length === 1 ? "" : "es"} ✓`);
    clearSelection();
  };
  const bulkAssignResponsible = async () => {
    if (!canManageCrm || !selectedItems.length || !bulkResponsible) return;
    const targetUser = tenantUsers.find(item => item.id === bulkResponsible);
    const nextOpps = (crmOpps || []).map(opp =>
      opp.empId === empId && selectedIds.includes(opp.id)
        ? crmNormalizeOpportunity({ ...opp, responsable: bulkResponsible, updatedAt: today() }, scopedStages)
        : opp,
    );
    await setCrmOpps(nextOpps);
    await setCrmActivities([
      ...(crmActivities || []),
      ...selectedItems.map(opp => crmActivityEntry(opp.id, `Responsable reasignado en lote a ${targetUser?.name || "nuevo responsable"}.`, "update", user, empId)),
    ]);
    ntf?.(`Responsable actualizado en ${selectedItems.length} oportunidad${selectedItems.length === 1 ? "" : "es"} ✓`);
    clearSelection();
  };
  const bulkDeleteSelected = async () => {
    if (!canManageCrm || !selectedItems.length) return;
    const confirmed = await requestConfirm({
      title: "Eliminar oportunidades",
      message: `¿Eliminar ${selectedItems.length} oportunidad${selectedItems.length === 1 ? "" : "es"} seleccionada${selectedItems.length === 1 ? "" : "s"}?`,
      confirmLabel: "Eliminar",
    });
    if (!confirmed) return;
    const selectedSet = new Set(selectedIds);
    await setCrmOpps((crmOpps || []).filter(opp => !(opp.empId === empId && selectedSet.has(opp.id))));
    await setCrmActivities((crmActivities || []).filter(act => !selectedSet.has(act.opportunityId)));
    if (tasksEnabled && canManageTasks) {
      await setTareas((Array.isArray(tareas) ? tareas : []).filter(task => !(task?.empId === empId && task.refTipo === "crm" && selectedSet.has(task.refId))));
    }
    ntf?.(`Se eliminaron ${selectedItems.length} oportunidad${selectedItems.length === 1 ? "" : "es"} ✓`, "warn");
    clearSelection();
  };
  const saveStageConfig = async next => {
    if (!hasTenant || !canManageCrm) return false;
    crmSavingRef.current = true;
    try {
      const normalized = normalizeCrmStages(
        recoverPreferredCrmStages(
          (Array.isArray(next) ? next : []).map(stage => ({ ...stage, empId })),
          empId,
        ),
      ).map((stage, idx) => ({
        ...stage,
        empId,
        order: idx + 1,
      }));
      await setCrmStages(normalized);
      ntf?.("Etapas CRM actualizadas ✓");
      return true;
    } finally {
      setTimeout(() => { crmSavingRef.current = false; }, 1000);
    }
  };
  const removeStage = async stageId => {
    const stage = scopedStages.find(item => item.id === stageId);
    if (!stage) return;
    if (scopedStages.length <= 2) {
      alert("Debes mantener al menos dos etapas en el pipeline.");
      return;
    }
    const fallback = scopedStages.find(item => item.id !== stageId && !item.closedLost) || scopedStages.find(item => item.id !== stageId);
    if (!fallback) return;
    const linked = scopedOpps.filter(opp => opp.stageId === stageId);
    const nextStages = scopedStages.filter(item => item.id !== stageId).map((item, idx) => ({ ...item, order: idx + 1 }));
    if (linked.length) {
      const nextOpps = (crmOpps || []).map(opp => opp.empId === empId && opp.stageId === stageId
        ? crmNormalizeOpportunity({ ...opp, stageId: fallback.id, status: fallback.closedWon ? "Ganada" : fallback.closedLost ? "Perdida" : "Activa" }, nextStages)
        : opp);
      await setCrmOpps(nextOpps);
    }
    await saveStageConfig(nextStages);
    ntf?.(`Etapa eliminada${linked.length ? ` y ${linked.length} oportunidad${linked.length === 1 ? "" : "es"} reasignada${linked.length === 1 ? "" : "s"}` : ""} ✓`);
  };

  return {
    isMobile,
    tab,
    setTab,
    q,
    setQ,
    tipo,
    setTipo,
    estado,
    setEstado,
    stageFilter,
    setStageFilter,
    nextActionFilter,
    setNextActionFilter,
    sortKey,
    setSortKey,
    pg,
    setPg,
    selectedIds,
    setSelectedIds,
    bulkResponsible,
    setBulkResponsible,
    bulkTipoNegocio,
    setBulkTipoNegocio,
    detailId,
    setDetailId,
    stagesOpen,
    setStagesOpen,
    localStages,
    setLocalStages,
    stagesChanged,
    setStagesChanged,
    activityForm,
    setActivityForm,
    mobileStageId,
    setMobileStageId,
    collapsedStages,
    setCollapsedStages,
    PP,
    tasksEnabled,
    scopedStages,
    scopedOpps,
    scopedActivities,
    tenantUsers,
    nextActionTone,
    sorted,
    paged,
    selectedItems,
    detail,
    detailActivities,
    detailTasks,
    stagesById,
    activeMobileStageId,
    mobileStage,
    mobileStageItems,
    addActivity,
    saveOpp,
    updateStage,
    updateQuickField,
    passToEntity,
    toggleSelected,
    toggleStageCollapsed,
    toggleAllVisible,
    exportTarget,
    clearSelection,
    bulkAssignTipoNegocio,
    bulkAssignResponsible,
    bulkDeleteSelected,
    saveStageConfig,
    removeStage,
    canManageCrm,
    canManageTasks,
  };
}
