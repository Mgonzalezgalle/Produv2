import {
  TREASURY_MODULE_ICON,
  TREASURY_MODULE_ID,
  TREASURY_MODULE_LABEL,
  buildTreasurySidebarItem,
} from "../utils/treasury";
import { getTenantModuleIcon, getTenantModuleLabel } from "../industry/tenantVocabulary";

export const BASE_MODULE_IDS = ["clientes"];

export const ADDON_REGISTRY = {
  producciones: { label: "Proyectos", icon: "▶", group: "Operación" },
  programas: { label: "Producciones", icon: "📺", group: "Operación" },
  contenidos: { label: "Contenidos", icon: "📱", group: "Operación" },
  crm: { label: "CRM", icon: "🧲" },
  tareas: { label: "Tareas", icon: "✅" },
  television: { label: "Pack televisión", icon: "📺", legacy: true, selectable: false },
  social: { label: "Pack contenidos", icon: "📱", legacy: true, selectable: false },
  auspiciadores: { label: "Auspiciadores", icon: "⭐", group: "Comercial" },
  presupuestos: { label: "Presupuestos", icon: "📋" },
  facturacion: { label: "Facturación", icon: "🧾" },
  [TREASURY_MODULE_ID]: { label: TREASURY_MODULE_LABEL, icon: TREASURY_MODULE_ICON },
  activos: { label: "Gestión Activos", icon: "📦" },
  contratos: { label: "Contratos", icon: "📄" },
  crew: { label: "Equipo / Crew", icon: "🎬" },
};

export const MODULE_LABELS = {
  dashboard: "DASHBOARD",
  calendario: "CALENDARIO",
  clientes: "CLIENTES",
  producciones: "PROYECTOS",
  programas: "PRODUCCIONES",
  contenidos: "CONTENIDOS",
  crew: "EQUIPO / CREW",
  auspiciadores: "AUSPICIADORES",
  contratos: "CONTRATOS",
  presupuestos: "PRESUPUESTOS",
  facturacion: "FACTURACIÓN",
  [TREASURY_MODULE_ID]: TREASURY_MODULE_LABEL.toUpperCase(),
  activos: "ACTIVOS",
  television: "TELEVISIÓN",
  social: "CONTENIDOS RRSS",
};

export const MODULE_ADDON_ALIASES = {
  producciones: ["television", "social"],
  programas: ["television"],
  contenidos: ["social"],
  auspiciadores: ["television"],
  television: ["programas"],
  social: ["contenidos"],
};

export function isBaseModule(moduleId = "") {
  return BASE_MODULE_IDS.includes(moduleId);
}

export function tenantHasModule(empresa = {}, moduleId = "") {
  if (isBaseModule(moduleId)) return true;
  const addons = Array.isArray(empresa?.addons) ? empresa.addons : [];
  const aliases = MODULE_ADDON_ALIASES[moduleId] || [];
  return addons.includes(moduleId) || aliases.some(alias => addons.includes(alias));
}

export function normalizeTenantAddons(addons = [], { migrateLegacy = false } = {}) {
  const source = Array.isArray(addons) ? addons.filter(Boolean) : [];
  const next = new Set(source);
  if (migrateLegacy) {
    if (source.includes("television")) {
      next.add("producciones");
      next.add("programas");
      next.add("auspiciadores");
    }
    if (source.includes("social")) {
      next.add("producciones");
      next.add("contenidos");
    }
  }
  BASE_MODULE_IDS.forEach(moduleId => next.delete(moduleId));
  return Array.from(next);
}

export function getSelectableAddons(addons = ADDON_REGISTRY) {
  return Object.entries(addons).filter(([, addon]) => addon?.selectable !== false);
}

export const ROLE_PERMISSION_GROUPS = [
  { label: "Base", items: [["clientes", "Clientes"], ["calendario", "Calendario"], ["tareas", "Tareas"]] },
  { label: "Operación", items: [["producciones", "Proyectos"], ["programas", "Producciones"], ["contenidos", "Contenidos"], ["crew", "Crew"], ["movimientos", "Movimientos"]] },
  { label: "Comercial", items: [["crm", "CRM"], ["auspiciadores", "Auspiciadores"], ["contratos", "Contratos"], ["presupuestos", "Presupuestos"], ["facturacion", "Facturación"], [TREASURY_MODULE_ID, TREASURY_MODULE_LABEL]] },
  { label: "Recursos", items: [["activos", "Activos"]] },
];

export function buildSidebarNavigation({ empresa, counts = {}, includeTreasury = true } = {}) {
  const labelFor = (moduleId, fallback) => getTenantModuleLabel(empresa, moduleId, fallback);
  const iconFor = (moduleId, fallback) => getTenantModuleIcon(empresa, moduleId, fallback);
  return [
    {
      group: "General",
      items: [
        { id: "dashboard", icon: "⊞", label: "Dashboard" },
        { id: "calendario", icon: "📅", label: "Calendario" },
        ...(tenantHasModule(empresa, "tareas") ? [{ id: "tareas", icon: "✅", label: "Mis Tareas", cnt: counts.tar }] : []),
      ],
    },
    {
      group: "Operación",
      items: [
        { id: "clientes", icon: iconFor("clientes", "👥"), label: labelFor("clientes", "Clientes"), need: "clientes", cnt: counts.cli },
        ...(tenantHasModule(empresa, "producciones") ? [{ id: "producciones", icon: iconFor("producciones", "▶"), label: labelFor("producciones", "Proyectos"), need: "producciones", cnt: counts.pro }] : []),
        ...(tenantHasModule(empresa, "programas") ? [{ id: "programas", icon: iconFor("programas", "📺"), label: labelFor("programas", "Producciones"), need: "programas", cnt: counts.pg }] : []),
        ...(tenantHasModule(empresa, "contenidos") ? [{ id: "contenidos", icon: iconFor("contenidos", "📱"), label: labelFor("contenidos", "Contenidos"), need: "contenidos", cnt: counts.pz }] : []),
      ],
    },
    {
      group: "Comercial",
      items: [
        ...(tenantHasModule(empresa, "crm") ? [{ id: "crm", icon: iconFor("crm", "🧲"), label: labelFor("crm", "CRM"), need: "crm", cnt: counts.crm }] : []),
        ...(tenantHasModule(empresa, "auspiciadores") ? [{ id: "auspiciadores", icon: iconFor("auspiciadores", "⭐"), label: labelFor("auspiciadores", "Auspiciadores"), need: "auspiciadores", cnt: counts.aus }] : []),
        ...(tenantHasModule(empresa, "presupuestos") ? [{ id: "presupuestos", icon: iconFor("presupuestos", "📋"), label: labelFor("presupuestos", "Presupuestos"), need: "presupuestos", cnt: counts.pres }] : []),
      ],
    },
    {
      group: "Finanzas",
      items: [
        ...(tenantHasModule(empresa, "facturacion") ? [{ id: "facturacion", icon: iconFor("facturacion", "🧾"), label: labelFor("facturacion", "Facturación"), need: "facturacion", cnt: counts.fact }] : []),
        ...(includeTreasury && tenantHasModule(empresa, TREASURY_MODULE_ID) ? [{ ...buildTreasurySidebarItem(counts.tes), icon: iconFor(TREASURY_MODULE_ID, TREASURY_MODULE_ICON), label: labelFor(TREASURY_MODULE_ID, TREASURY_MODULE_LABEL) }] : []),
      ],
    },
    {
      group: "Recursos",
      items: [
        ...(tenantHasModule(empresa, "crew") ? [{ id: "crew", icon: iconFor("crew", "🎬"), label: labelFor("crew", "Equipo / Crew"), need: "crew", cnt: counts.crew }] : []),
        ...(tenantHasModule(empresa, "contratos") ? [{ id: "contratos", icon: iconFor("contratos", "📄"), label: labelFor("contratos", "Contratos"), need: "contratos", cnt: counts.ct }] : []),
        ...(tenantHasModule(empresa, "activos") ? [{ id: "activos", icon: iconFor("activos", "📦"), label: labelFor("activos", "Activos"), need: "activos", cnt: counts.act }] : []),
      ],
    },
  ];
}
