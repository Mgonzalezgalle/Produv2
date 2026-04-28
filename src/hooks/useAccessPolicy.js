import { useMemo } from "react";
import { actionNeedsAddon, canAccessModule, canDo, getRoleConfig, hasAddon, requiredAddonForAction } from "../lib/auth/authorization";

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
      requiredAddonForAction(action) {
        return requiredAddonForAction(action);
      },
      canAccessView(nextView = view) {
        return canAccessModule(safeUser, nextView, safeEmpresa);
      },
      hasAddonEnabled(addon) {
        return hasAddon(safeEmpresa, addon);
      },
      tasksEnabled: actionNeedsAddon("tareas", safeEmpresa),
      budgetsEnabled: actionNeedsAddon("presupuestos", safeEmpresa),
      invoicesEnabled: actionNeedsAddon("facturacion", safeEmpresa),
      socialEnabled: actionNeedsAddon("contenidos", safeEmpresa),
    };
  }, [empresa, user, view]);
}
