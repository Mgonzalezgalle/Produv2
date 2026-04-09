import { useCallback } from "react";
import { crmActivityEntry } from "../lib/utils/crm";

export function useLabModalActions({
  empresa,
  mData,
  contratos,
  piezas,
  crmStages,
  crmOpps,
  crmActivities,
  user,
  tareas,
  cSave,
  setContratos,
  setPiezas,
  setCrmOpps,
  setCrmActivities,
  setTareas,
  closeM,
  ntf,
  uid,
  today,
  helpers,
  canDo,
}) {
  const empId = empresa?.id;
  const withEmp = useCallback((d) => ({ ...d, empId }), [empId]);
  const canManageCrm = !!(canDo && canDo("crm"));
  const canManageTasks = !!(canDo && canDo("tareas"));
  const canManageContracts = !!(canDo && canDo("contratos"));
  const canManageContent = !!(canDo && canDo("contenidos"));

  const saveContratoSafe = useCallback(async (d) => {
    if (!empId || !canManageContracts) return false;
    const nextItem = withEmp(d);
    const existing = (contratos || []).find((item) => item.id === nextItem.id);
    const merged = existing ? { ...existing, ...nextItem } : nextItem;
    await cSave(contratos, setContratos, merged);
    return true;
  }, [cSave, canManageContracts, contratos, setContratos, withEmp]);

  const saveContentPiece = useCallback(async (d) => {
    if (!empId || !canManageContent) return false;
    const campId = mData?.campId;
    if (!campId) return false;
    const next = (piezas || []).map((c) => (
      c.id !== campId
        ? c
        : {
            ...c,
            piezas: (c.piezas || []).some((p) => p.id === d.id)
              ? (c.piezas || []).map((p) => (p.id === d.id ? helpers.normalizeSocialPiece(d, c) : p))
              : [...(c.piezas || []), helpers.normalizeSocialPiece(d, c)],
          }
    ));
    await setPiezas(next);
    closeM();
    ntf("Pieza guardada ✓");
    return true;
  }, [canManageContent, closeM, empId, helpers, mData?.campId, ntf, piezas, setPiezas]);

  const saveCrmOpp = useCallback(async (d) => {
    if (!empId || !canManageCrm) return false;
    const item = helpers.crmNormalizeOpportunity(withEmp(d), crmStages);
    const arr = Array.isArray(crmOpps) ? crmOpps : [];
    const exists = arr.some((x) => x.id === item.id);
    const next = exists ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item];
    await setCrmOpps(next);
    const activity = crmActivityEntry(
      item.id,
      exists ? "Oportunidad actualizada." : "Oportunidad creada en CRM.",
      exists ? "update" : "created",
      user,
      empId,
    );
    await setCrmActivities([...(Array.isArray(crmActivities) ? crmActivities : []), activity]);
    closeM();
    ntf(exists ? "Oportunidad actualizada ✓" : "Oportunidad creada ✓");
    return true;
  }, [canManageCrm, closeM, crmActivities, crmOpps, crmStages, empId, helpers, ntf, setCrmActivities, setCrmOpps, user, withEmp]);

  const saveTask = useCallback(async (d) => {
    if (!empId || !canManageTasks) return false;
    const item = { ...withEmp(d), id: d.id || uid(), cr: d.cr || today() };
    const arr = Array.isArray(tareas) ? tareas.filter((x) => x && typeof x === "object") : [];
    const next = arr.find((x) => x.id === item.id) ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item];
    await setTareas(next);
    closeM();
    ntf("Tarea guardada ✓");
    return true;
  }, [canManageTasks, closeM, ntf, setTareas, tareas, today, uid, withEmp]);

  return {
    withEmp,
    saveContratoSafe,
    saveContentPiece,
    saveCrmOpp,
    saveTask,
  };
}
