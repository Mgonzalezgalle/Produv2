export const ROLES = {
  superadmin: { label: "Super Admin", color: "#ff5566" },
  admin: { label: "Administrador", color: "#00d4e8" },
  productor: { label: "Productor", color: "#00e08a" },
  comercial: { label: "Comercial", color: "#ffcc44" },
  viewer: { label: "Visualizador", color: "#7c7c8a" },
};

export const ROLE_COLOR_MAP = {
  superadmin: "red",
  admin: "cyan",
  productor: "green",
  comercial: "yellow",
  viewer: "gray",
};

export const PERMS = {
  productor: ["clientes","producciones","programas","piezas","contenidos","crew","calendario","movimientos","eventos"],
  comercial: ["clientes","auspiciadores","contratos","crm","tesoreria"],
};

export const ROLE_PERMISSION_GROUPS = [
  { label: "General", items: [["calendario","Calendario"],["tareas","Tareas"]] },
  { label: "Operación", items: [["clientes","Clientes"],["producciones","Proyectos"],["programas","Producciones"],["contenidos","Contenidos"],["crew","Crew"],["movimientos","Movimientos"]] },
  { label: "Comercial", items: [["crm","CRM"],["auspiciadores","Auspiciadores"],["contratos","Contratos"],["presupuestos","Presupuestos"],["facturacion","Facturación"],["tesoreria","Tesorería"]] },
  { label: "Recursos", items: [["activos","Activos"]] },
];

export function hasAddon(empresa, addon) {
  return Array.isArray(empresa?.addons) && empresa.addons.includes(addon);
}

export function getCustomRoles(empresa = {}) {
  return Array.isArray(empresa?.customRoles) ? empresa.customRoles : [];
}

export function getRoleConfig(role, empresa) {
  if (ROLES[role]) {
    return {
      key: role,
      label: ROLES[role].label,
      color: ROLES[role].color,
      badge: ROLE_COLOR_MAP[role] || "gray",
      permissions: PERMS[role] || [],
    };
  }
  const custom = getCustomRoles(empresa).find(r => r.key === role);
  if (custom) {
    return {
      key: custom.key,
      label: custom.label,
      color: custom.color || "#7c7c8a",
      badge: custom.badge || "gray",
      permissions: Array.isArray(custom.permissions) ? custom.permissions : [],
    };
  }
  return { key: role, label: role, color: "#7c7c8a", badge: "gray", permissions: [] };
}

export function roleOptions(empresa, includeSuperadmin = false) {
  const base = Object.entries(ROLES)
    .filter(([k]) => includeSuperadmin || k !== "superadmin")
    .map(([k, v]) => ({ value: k, label: v.label }));
  const custom = getCustomRoles(empresa).map(r => ({ value: r.key, label: r.label }));
  return [...base, ...custom];
}

export function assignableRoleOptions(empresa, actor, includeSuperadmin = false) {
  const options = roleOptions(empresa, includeSuperadmin);
  if (actor?.role === "superadmin") return options;
  if (actor?.role === "admin") return options.filter(o => o.value !== "superadmin");
  return options.filter(o => !["admin", "superadmin"].includes(o.value));
}

export function sanitizeAssignableRole(role, empresa, actor, fallback = "viewer") {
  const allowed = assignableRoleOptions(empresa, actor, true).map(o => o.value);
  return allowed.includes(role) ? role : fallback;
}

export function canDo(user, action, empresa) {
  if (!user) return false;
  if (user.role === "superadmin" || user.role === "admin") return true;
  if (user.role === "viewer") return false;
  const custom = getCustomRoles(empresa).find(r => r.key === user.role);
  if (custom) return (custom.permissions || []).includes(action);
  return PERMS[user.role]?.includes(action) ?? false;
}

export function canAccessModule(user, view, empresa) {
  const gated = {
    tareas: "tareas",
    crm: "crm",
    presupuestos: "presupuestos",
    "pres-det": "presupuestos",
    facturacion: "facturacion",
    tesoreria: "tesoreria",
  };
  const action = gated[view];
  if (!action) return true;
  if (action === "tareas") return hasAddon(empresa, "tareas") && user?.role !== "viewer";
  if (action === "crm" && !hasAddon(empresa, "crm")) return false;
  if (action === "presupuestos" && !hasAddon(empresa, "presupuestos")) return false;
  if (action === "facturacion" && !hasAddon(empresa, "facturacion")) return false;
  if (action === "tesoreria" && !hasAddon(empresa, "tesoreria")) return false;
  return canDo(user, action, empresa);
}
