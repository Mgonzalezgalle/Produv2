import {
  TREASURY_MODULE_ICON,
  TREASURY_MODULE_ID,
  TREASURY_MODULE_LABEL,
  buildTreasurySidebarItem,
} from "../utils/treasury";

export const ADDON_REGISTRY = {
  crm: { label: "CRM", icon: "🧲" },
  tareas: { label: "Tareas", icon: "✅" },
  television: { label: "Televisión", icon: "📺" },
  social: { label: "Contenidos RRSS", icon: "📱" },
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

export const ROLE_PERMISSION_GROUPS = [
  { label: "General", items: [["calendario", "Calendario"], ["tareas", "Tareas"]] },
  { label: "Operación", items: [["clientes", "Clientes"], ["producciones", "Proyectos"], ["programas", "Producciones"], ["contenidos", "Contenidos"], ["crew", "Crew"], ["movimientos", "Movimientos"]] },
  { label: "Comercial", items: [["crm", "CRM"], ["auspiciadores", "Auspiciadores"], ["contratos", "Contratos"], ["presupuestos", "Presupuestos"], ["facturacion", "Facturación"], [TREASURY_MODULE_ID, TREASURY_MODULE_LABEL]] },
  { label: "Recursos", items: [["activos", "Activos"]] },
];

export function buildSidebarNavigation({ empresa, counts = {}, includeTreasury = true } = {}) {
  return [
    {
      group: "General",
      items: [
        { id: "dashboard", icon: "⊞", label: "Dashboard" },
        { id: "calendario", icon: "📅", label: "Calendario" },
        ...(empresa?.addons?.includes("tareas") ? [{ id: "tareas", icon: "✅", label: "Mis Tareas", cnt: counts.tar }] : []),
      ],
    },
    {
      group: "Operación",
      items: [
        { id: "clientes", icon: "👥", label: "Clientes", need: "clientes", cnt: counts.cli },
        { id: "producciones", icon: "▶", label: "Proyectos", need: "producciones", cnt: counts.pro },
        ...(empresa?.addons?.includes("television") ? [{ id: "programas", icon: "📺", label: "Producciones", need: "programas", cnt: counts.pg }] : []),
        ...(empresa?.addons?.includes("social") ? [{ id: "contenidos", icon: "📱", label: "Contenidos", need: "contenidos", cnt: counts.pz }] : []),
      ],
    },
    {
      group: "Comercial",
      items: [
        ...(empresa?.addons?.includes("crm") ? [{ id: "crm", icon: "🧲", label: "CRM", need: "crm", cnt: counts.crm }] : []),
        ...(empresa?.addons?.includes("television") ? [{ id: "auspiciadores", icon: "⭐", label: "Auspiciadores", need: "auspiciadores", cnt: counts.aus }] : []),
        ...(empresa?.addons?.includes("presupuestos") ? [{ id: "presupuestos", icon: "📋", label: "Presupuestos", need: "presupuestos", cnt: counts.pres }] : []),
      ],
    },
    {
      group: "Finanzas",
      items: [
        ...(empresa?.addons?.includes("facturacion") ? [{ id: "facturacion", icon: "🧾", label: "Facturación", need: "facturacion", cnt: counts.fact }] : []),
        ...(includeTreasury && empresa?.addons?.includes(TREASURY_MODULE_ID) ? [buildTreasurySidebarItem(counts.tes)] : []),
      ],
    },
    {
      group: "Recursos",
      items: [
        ...(empresa?.addons?.includes("crew") ? [{ id: "crew", icon: "🎬", label: "Equipo / Crew", need: "crew", cnt: counts.crew }] : []),
        ...(empresa?.addons?.includes("contratos") ? [{ id: "contratos", icon: "📄", label: "Contratos", need: "contratos", cnt: counts.ct }] : []),
        ...(empresa?.addons?.includes("activos") ? [{ id: "activos", icon: "📦", label: "Activos", need: "activos", cnt: counts.act }] : []),
      ],
    },
  ];
}
