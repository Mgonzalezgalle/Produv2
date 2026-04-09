import { useMemo } from "react";
import { canAccessModule, canDo, getRoleConfig, hasAddon } from "../lib/auth/authorization";

export function useAccessPolicy({ user, empresa, view }) {
  return useMemo(() => {
    const safeUser = user || null;
    const safeEmpresa = empresa || null;
    const roleConfig = safeUser ? getRoleConfig(safeUser.role, safeEmpresa) : null;
    return {
      roleConfig,
      canDoAction(action) {
        return canDo(safeUser, action, safeEmpresa);
      },
      canAccessView(nextView = view) {
        return canAccessModule(safeUser, nextView, safeEmpresa);
      },
      hasAddonEnabled(addon) {
        return hasAddon(safeEmpresa, addon);
      },
      tasksEnabled: hasAddon(safeEmpresa, "tareas"),
      budgetsEnabled: hasAddon(safeEmpresa, "presupuestos"),
      invoicesEnabled: hasAddon(safeEmpresa, "facturacion"),
      socialEnabled: hasAddon(safeEmpresa, "social"),
    };
  }, [empresa, user, view]);
}

