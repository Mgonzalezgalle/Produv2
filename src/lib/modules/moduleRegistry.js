import {
  TREASURY_MODULE_ICON,
  TREASURY_MODULE_ID,
  TREASURY_MODULE_LABEL,
  buildTreasurySidebarItem,
} from "../utils/treasury";
import { getTenantModuleIcon, getTenantModuleLabel } from "../industry/tenantVocabulary";
import { tenantHasModule } from "./moduleAccess";

export {
  BASE_MODULE_IDS,
  MODULE_ADDON_ALIASES,
  isBaseModule,
  normalizeTenantAddons,
  tenantHasModule,
} from "./moduleAccess";

export const ADDON_REGISTRY = {
  calendario: { label: "Calendario", icon: "📅", group: "Base" },
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
        ...(tenantHasModule(empresa, "calendario") ? [{ id: "calendario", icon: "📅", label: "Calendario", need: "calendario" }] : []),
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
