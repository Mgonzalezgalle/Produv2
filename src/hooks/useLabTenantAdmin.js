import { useCallback } from "react";
import { LAB_DATA_CONFIG, localLabKey } from "../lib/lab/storageNamespace";

export function useLabTenantAdmin({
  dbGet,
  dbSet,
  empresas,
  users,
  supportThreads,
  supportSettings,
  normalizeEmpresasModel,
  ensureRequiredSystemUsers,
  normalizeSupportThreads,
  setEmpresasRaw,
  setUsersRaw,
  setSupportThreadsRaw,
  curEmp,
  curUser,
  setCurEmp,
  setCurUser,
  setStoredSession,
  ntf,
}) {
  const deleteEmpresa = useCallback(async emp => {
    if (LAB_DATA_CONFIG.releaseMode) {
      ntf("La eliminación de instancias está bloqueada en release mode", "warn");
      return;
    }
    if (!emp?.id) return;
    if (emp.active !== false) {
      ntf("Primero desactiva la empresa antes de eliminarla", "warn");
      return;
    }
    const confirmDelete = confirm(`¿Eliminar la instancia ${emp.nombre}?\n\nEsto borrará usuarios y datos asociados del tenant. Esta acción no se puede deshacer.`);
    if (!confirmDelete) return;

    const targetId = emp.id;
    const tenantKeys = ["listas","tareas","clientes","producciones","programas","piezas","episodios","auspiciadores","crmOpps","crmActivities","crmStages","contratos","movimientos","crew","eventos","presupuestos","facturas","activos"];

    await Promise.all(tenantKeys.map(key => dbSet(`produ:${targetId}:${key}`, [])));

    const nextEmpresas = normalizeEmpresasModel((empresas || []).filter(item => item.id !== targetId));
    const nextUsersBase = (users || []).filter(item => item.empId !== targetId);
    const nextUsers = LAB_DATA_CONFIG.releaseMode ? nextUsersBase : ensureRequiredSystemUsers(nextUsersBase);
    const nextThreads = normalizeSupportThreads((supportThreads || []).filter(thread => thread.empId !== targetId), nextEmpresas, nextUsers, supportSettings || {});

    setEmpresasRaw(nextEmpresas);
    setUsersRaw(nextUsers);
    setSupportThreadsRaw(nextThreads);

    await dbSet("produ:empresas", nextEmpresas);
    await dbSet("produ:users", nextUsers);
    await dbSet("produ:supportThreads", nextThreads);

    try {
      const solicitudes = await dbGet("produ:solicitudes");
      if (Array.isArray(solicitudes)) {
        const nextSolicitudes = solicitudes.filter(sol => sol.empresaId !== targetId && sol.referredByEmpId !== targetId);
        await dbSet("produ:solicitudes", nextSolicitudes);
      }
    } catch {}

    if (curEmp?.id === targetId) {
      setCurEmp(null);
      if (curUser?.role !== "superadmin") {
        setCurUser(null);
        try { localStorage.removeItem(localLabKey("session")); } catch {}
        setStoredSession(null);
      }
    }

    ntf("Instancia eliminada", "warn");
  }, [
    dbGet,
    dbSet,
    empresas,
    users,
    supportThreads,
    supportSettings,
    normalizeEmpresasModel,
    ensureRequiredSystemUsers,
    normalizeSupportThreads,
    setEmpresasRaw,
    setUsersRaw,
    setSupportThreadsRaw,
    curEmp?.id,
    curUser?.role,
    setCurEmp,
    setCurUser,
    setStoredSession,
    ntf,
  ]);

  return { deleteEmpresa };
}
