import { useCallback } from "react";

export function useLabPersistence({
  curEmp,
  crew,
  setCrew,
  setUsersRaw,
  setEmpresasRaw,
  setPrintLayoutsRaw,
  setSupportThreadsRaw,
  setSupportSettingsRaw,
  dbSet,
  normalizeUsersAuth,
  normalizeEmpresasModel,
  normalizePrintLayouts,
  normalizeSupportThreads,
  buildSupportSettings,
  syncCrewWithUsers,
  empresas,
  users,
  supportSettings,
  ntf,
}) {
  const saveUsers = useCallback(async nextUsers => {
    const resolvedUsers = typeof nextUsers === "function" ? nextUsers(users || []) : nextUsers;
    const normalized = await normalizeUsersAuth(resolvedUsers);
    setUsersRaw(normalized);
    await dbSet("produ:users", normalized);

    if (curEmp?.id) {
      const scopedUsers = normalized.filter(user => user?.empId === curEmp.id);
      const currentCrew = (crew || []).filter(member => member?.empId === curEmp.id);
      const syncedCrew = syncCrewWithUsers(scopedUsers, currentCrew);
      await setCrew(syncedCrew);
    }
  }, [normalizeUsersAuth, setUsersRaw, dbSet, curEmp?.id, crew, syncCrewWithUsers, setCrew, users]);

  const saveEmpresas = useCallback(nextEmpresas => {
    const resolvedEmpresas = typeof nextEmpresas === "function" ? nextEmpresas(empresas || []) : nextEmpresas;
    const normalized = normalizeEmpresasModel(resolvedEmpresas);
    setEmpresasRaw(normalized);
    return dbSet("produ:empresas", normalized);
  }, [normalizeEmpresasModel, setEmpresasRaw, dbSet, empresas]);

  const savePrintLayouts = useCallback(async layouts => {
    const normalized = normalizePrintLayouts(layouts);
    setPrintLayoutsRaw(normalized);
    await dbSet("produ:printLayouts", normalized);
    ntf("Composición de impresos guardada ✓");
  }, [normalizePrintLayouts, setPrintLayoutsRaw, dbSet, ntf]);

  const saveSupportThreads = useCallback(async threads => {
    const normalized = normalizeSupportThreads(threads, empresas || [], users || [], supportSettings || {});
    setSupportThreadsRaw(normalized);
    await dbSet("produ:supportThreads", normalized);
  }, [normalizeSupportThreads, empresas, users, supportSettings, setSupportThreadsRaw, dbSet]);

  const saveSupportSettings = useCallback(async settings => {
    const normalized = buildSupportSettings(settings, users || []);
    setSupportSettingsRaw(normalized);
    await dbSet("produ:supportSettings", normalized);
  }, [buildSupportSettings, users, setSupportSettingsRaw, dbSet]);

  const saveSuperData = useCallback((key, data) => {
    if (key === "empresas") saveEmpresas(data);
    if (key === "users") saveUsers(data);
    if (key === "supportThreads") saveSupportThreads(data);
    if (key === "supportSettings") saveSupportSettings(data);
    ntf("Guardado ✓");
  }, [saveEmpresas, saveUsers, saveSupportThreads, saveSupportSettings, ntf]);

  return {
    saveUsers,
    saveEmpresas,
    savePrintLayouts,
    saveSupportThreads,
    saveSupportSettings,
    saveSuperData,
  };
}
