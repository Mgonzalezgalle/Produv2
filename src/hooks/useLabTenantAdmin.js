import { useCallback } from "react";
import { LAB_DATA_CONFIG, localLabKey } from "../lib/lab/labStorageConfig";
import { requestConfirm } from "../lib/ui/confirmService";

export function useLabTenantAdmin({
  dbGet,
  dbSet,
  empresas,
  users,
  normalizeEmpresasModel,
  ensureRequiredSystemUsers,
  setEmpresasRaw,
  setUsersRaw,
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
    const confirmDelete = await requestConfirm({
      title: "Eliminar instancia",
      message: `¿Eliminar la instancia ${emp.nombre}?\n\nEsto borrará usuarios y datos asociados del tenant. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar instancia",
    });
    if (!confirmDelete) return;

    const targetId = emp.id;
    const tenantKeys = [
      "listas",
      "tareas",
      "clientes",
      "producciones",
      "programas",
      "piezas",
      "episodios",
      "auspiciadores",
      "crmOpps",
      "crmActivities",
      "crmStages",
      "contratos",
      "movimientos",
      "crew",
      "eventos",
      "presupuestos",
      "facturas",
      "activos",
      "supportThreads",
      "treasuryProviders",
      "treasuryPayables",
      "treasuryPurchaseOrders",
      "treasuryIssuedOrders",
      "treasuryReceipts",
      "treasuryDisbursements",
    ];

    await Promise.all(tenantKeys.map(key => dbSet(`produ:${targetId}:${key}`, [])));

    const nextEmpresas = normalizeEmpresasModel((empresas || []).filter(item => item.id !== targetId));
    const nextUsersBase = (users || []).filter(item => item.empId !== targetId);
    const nextUsers = LAB_DATA_CONFIG.releaseMode ? nextUsersBase : ensureRequiredSystemUsers(nextUsersBase);

    setEmpresasRaw(nextEmpresas);
    setUsersRaw(nextUsers);

    await dbSet("produ:empresas", nextEmpresas);
    await dbSet("produ:users", nextUsers);

    try {
      const solicitudes = await dbGet("produ:solicitudes");
      if (Array.isArray(solicitudes)) {
        const nextSolicitudes = solicitudes.filter(sol => sol.empresaId !== targetId && sol.referredByEmpId !== targetId);
        await dbSet("produ:solicitudes", nextSolicitudes);
      }
    } catch (error) {
      console.warn("tenant_admin_delete_empresa_solicitudes_cleanup_failed", error);
    }

    if (curEmp?.id === targetId) {
        setCurEmp(null);
      if (curUser?.role !== "superadmin") {
        setCurUser(null);
        try { localStorage.removeItem(localLabKey("session")); } catch (error) { console.warn("tenant_admin_delete_empresa_session_cleanup_failed", error); }
        setStoredSession(null);
      }
    }

    ntf("Instancia eliminada", "warn");
  }, [
    dbGet,
    dbSet,
    empresas,
    users,
    normalizeEmpresasModel,
    ensureRequiredSystemUsers,
    setEmpresasRaw,
    setUsersRaw,
    curEmp?.id,
    curUser?.role,
    setCurEmp,
    setCurUser,
    setStoredSession,
    ntf,
  ]);

  return { deleteEmpresa };
}
