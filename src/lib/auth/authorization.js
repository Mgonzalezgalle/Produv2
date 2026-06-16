import { tenantHasModule } from "../modules/moduleAccess";

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
  { label: "Base", items: [["clientes","Clientes"],["calendario","Calendario"],["tareas","Tareas"]] },
  { label: "Operación", items: [["producciones","Proyectos"],["programas","Producciones"],["contenidos","Contenidos"],["crew","Crew"],["movimientos","Movimientos"]] },
  { label: "Comercial", items: [["crm","CRM"],["auspiciadores","Auspiciadores"],["contratos","Contratos"],["presupuestos","Presupuestos"],["facturacion","Facturación"],["tesoreria","Tesorería"]] },
  { label: "Recursos", items: [["activos","Activos"]] },
];

const ACTION_ALIASES = {
  piezas: "contenidos",
};

const ACTION_ADDON_REQUIREMENTS = {
  tareas: "tareas",
  producciones: "producciones",
  programas: "programas",
  auspiciadores: "auspiciadores",
  contenidos: "contenidos",
  crm: "crm",
  presupuestos: "presupuestos",
  facturacion: "facturacion",
  tesoreria: "tesoreria",
  crew: "crew",
  contratos: "contratos",
  activos: "activos",
};

const VIEW_ACCESS_RULES = {
  tareas: { action: "tareas" },
  producciones: { action: "producciones" },
  "pro-det": { action: "producciones" },
  programas: { action: "programas" },
  "pg-det": { action: "programas" },
  "ep-det": { action: "programas" },
  contenidos: { action: "contenidos" },
  "contenido-det": { action: "contenidos" },
  "pieza-det": { action: "contenidos" },
  crm: { action: "crm" },
  auspiciadores: { action: "auspiciadores" },
  contratos: { action: "contratos" },
  presupuestos: { action: "presupuestos" },
  "pres-det": { action: "presupuestos" },
  facturacion: { action: "facturacion" },
  tesoreria: { action: "tesoreria" },
  crew: { action: "crew" },
  activos: { action: "activos" },
};

const ADMIN_SECTION_RULES = {
  Colores: ["admin", "superadmin"],
  Usuarios: ["admin", "superadmin"],
  Empresa: ["admin", "superadmin"],
  Listas: ["admin", "superadmin"],
  "Roles y Permisos": ["admin", "superadmin"],
  Plataforma: ["superadmin"],
  Correo: ["admin", "superadmin"],
};

export function normalizePermissionAction(action = "") {
  const raw = String(action || "").trim();
  return ACTION_ALIASES[raw] || raw;
}

export function hasAddon(empresa, addon) {
  return tenantHasModule(empresa, addon);
}

export function requiredAddonForAction(action = "") {
  const normalized = normalizePermissionAction(action);
  return ACTION_ADDON_REQUIREMENTS[normalized] || null;
}

export function actionNeedsAddon(action = "", empresa) {
  const addon = requiredAddonForAction(action);
  if (!addon) return true;
  return hasAddon(empresa, addon);
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
  const normalized = normalizePermissionAction(action);
  if (!normalized) return false;
  if (!actionNeedsAddon(normalized, empresa)) return false;
  if (user.role === "superadmin" || user.role === "admin") return true;
  if (user.role === "viewer") return false;
  const custom = getCustomRoles(empresa).find(r => r.key === user.role);
  if (custom) return (custom.permissions || []).map(normalizePermissionAction).includes(normalized);
  return (PERMS[user.role] || []).map(normalizePermissionAction).includes(normalized);
}

export function canAccessModule(user, view, empresa) {
  const rule = VIEW_ACCESS_RULES[view];
  if (!rule?.action) return true;
  if (!actionNeedsAddon(rule.action, empresa)) return false;
  if (rule.action === "tareas") return user?.role !== "viewer";
  return canDo(user, rule.action, empresa);
}

export function canManageAdminPanel(user) {
  return ["admin", "superadmin"].includes(String(user?.role || "").trim());
}

export function canManageSuperAdminPanel(user) {
  return String(user?.role || "").trim() === "superadmin";
}

export function canAccessAdminSection(user, section = "") {
  const rule = ADMIN_SECTION_RULES[String(section || "").trim()];
  if (!rule) return canManageAdminPanel(user);
  return rule.includes(String(user?.role || "").trim());
}

export function getAccessibleAdminSections(user, sections = []) {
  return (Array.isArray(sections) ? sections : []).filter(section => canAccessAdminSection(user, section));
}
