import { useCallback } from "react";

export function useLabPersistence({
  curEmp,
  crew,
  setCrew,
  setUsersRaw,
  setEmpresasRaw,
  setPrintLayoutsRaw,
  dbSet,
  normalizeUsersAuth,
  normalizeEmpresasModel,
  normalizePrintLayouts,
  syncCrewWithUsers,
  ntf,
}) {
  const saveUsers = useCallback(async nextUsers => {
    const normalized = await normalizeUsersAuth(nextUsers);
    setUsersRaw(normalized);
    await dbSet("produ:users", normalized);

    if (curEmp?.id) {
      const scopedUsers = normalized.filter(user => user?.empId === curEmp.id);
      const currentCrew = (crew || []).filter(member => member?.empId === curEmp.id);
      const syncedCrew = syncCrewWithUsers(scopedUsers, currentCrew);
      await setCrew(syncedCrew);
    }
  }, [normalizeUsersAuth, setUsersRaw, dbSet, curEmp?.id, crew, syncCrewWithUsers, setCrew]);

  const saveEmpresas = useCallback(nextEmpresas => {
    const normalized = normalizeEmpresasModel(nextEmpresas);
    setEmpresasRaw(normalized);
    return dbSet("produ:empresas", normalized);
  }, [normalizeEmpresasModel, setEmpresasRaw, dbSet]);

  const savePrintLayouts = useCallback(async layouts => {
    const normalized = normalizePrintLayouts(layouts);
    setPrintLayoutsRaw(normalized);
    await dbSet("produ:printLayouts", normalized);
    ntf("Composición de impresos guardada ✓");
  }, [normalizePrintLayouts, setPrintLayoutsRaw, dbSet, ntf]);

  const saveSuperData = useCallback((key, data) => {
    if (key === "empresas") saveEmpresas(data);
    if (key === "users") saveUsers(data);
    ntf("Guardado ✓");
  }, [saveEmpresas, saveUsers, ntf]);

  return {
    saveUsers,
    saveEmpresas,
    savePrintLayouts,
    saveSuperData,
  };
}
