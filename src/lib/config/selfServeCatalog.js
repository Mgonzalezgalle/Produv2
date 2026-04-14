import { TREASURY_MODULE_ID } from "../utils/treasury";

export const SELF_SERVE_PRICE_UNIT = "UF / mes";
export const SELF_SERVE_BASE_CODE = "base_produ";

export const SELF_SERVE_BASE_PRODUCT = {
  code: SELF_SERVE_BASE_CODE,
  label: "Base Produ",
  shortLabel: "Base",
  required: true,
  monthlyUF: 1,
  description: "Entrada mínima obligatoria para operar en Produ con una estructura clara y lista para crecer.",
  includes: [
    { code: "dashboard", label: "Dashboard" },
    { code: "calendario", label: "Calendario" },
    { code: "clientes", label: "Clientes" },
    { code: "producciones", label: "Proyectos" },
  ],
};

export const SELF_SERVE_ADDON_GROUPS = [
  { code: "comercial", label: "Comercial" },
  { code: "finanzas", label: "Finanzas" },
  { code: "operacion", label: "Operación" },
  { code: "recursos", label: "Recursos" },
];

export const SELF_SERVE_ADDON_CATALOG = [
  {
    code: "crm",
    label: "CRM",
    group: "comercial",
    monthlyUF: 4,
    badge: "Crecimiento",
    description: "Organiza oportunidades, seguimiento comercial y pipeline de ventas.",
    audience: "Equipos comerciales y de cuentas",
    includes: ["Oportunidades", "Actividades", "Etapas", "Responsables"],
    recommendedWith: ["presupuestos"],
  },
  {
    code: "presupuestos",
    label: "Presupuestos",
    group: "comercial",
    monthlyUF: 4,
    badge: "Conversión",
    description: "Permite cotizar, aprobar y convertir presupuestos hacia la operación.",
    audience: "Comercial, cuentas y dirección",
    includes: ["Cotizaciones", "Estados", "Líneas", "Conversión a operación"],
    recommendedWith: ["facturacion"],
  },
  {
    code: "facturacion",
    label: "Facturación",
    group: "finanzas",
    monthlyUF: 5,
    badge: "Core financiero",
    description: "Centraliza emisión, órdenes de compra recibidas y gestión documental comercial.",
    audience: "Administración y finanzas",
    includes: ["Facturas", "Invoices", "Órdenes de factura", "OC recibidas"],
    recommendedWith: ["presupuestos", TREASURY_MODULE_ID],
  },
  {
    code: TREASURY_MODULE_ID,
    label: "Tesorería",
    group: "finanzas",
    monthlyUF: 6,
    badge: "Control financiero",
    description: "Conecta cartera, cuentas por cobrar, cuentas por pagar y seguimiento de pagos.",
    audience: "Finanzas y administración",
    includes: ["CxC", "CxP", "Cartera cliente", "Cartera proveedor", "Pagos"],
    recommendedWith: ["facturacion"],
  },
  {
    code: "television",
    label: "Producciones Audiovisuales",
    group: "operacion",
    monthlyUF: 6,
    badge: "Operación",
    description: "Gestiona producciones audiovisuales, episodios y auspiciadores.",
    audience: "Productoras audiovisuales",
    includes: ["Producciones", "Episodios", "Auspiciadores", "Seguimiento operativo"],
    recommendedWith: ["crew", "tareas"],
  },
  {
    code: "social",
    label: "Contenidos",
    group: "operacion",
    monthlyUF: 5,
    badge: "Contenido",
    description: "Ordena campañas, piezas y operación de contenido digital.",
    audience: "Equipos de contenido y social media",
    includes: ["Campañas", "Piezas", "Tareas", "Ingresos y gastos"],
    recommendedWith: ["tareas"],
  },
  {
    code: "tareas",
    label: "Tareas",
    group: "operacion",
    monthlyUF: 2,
    badge: "Orden",
    description: "Coordina trabajo pendiente, responsables y estados de ejecución.",
    audience: "Todos los equipos",
    includes: ["Mis tareas", "Estados", "Asignación", "Seguimiento"],
    recommendedWith: ["social", "television", "crm"],
  },
  {
    code: "crew",
    label: "Crew",
    group: "recursos",
    monthlyUF: 3,
    badge: "Equipo",
    description: "Gestiona equipo interno y externo, asignaciones y honorarios operativos.",
    audience: "Producción y operaciones",
    includes: ["Personas", "Asignaciones", "Honorarios", "Relación con producciones"],
    recommendedWith: ["television", "social"],
  },
  {
    code: "contratos",
    label: "Contratos",
    group: "recursos",
    monthlyUF: 3,
    badge: "Formalización",
    description: "Ordena contratos y su relación con clientes, proyectos o producciones.",
    audience: "Administración y dirección",
    includes: ["Contratos", "Vinculación", "Seguimiento documental"],
    recommendedWith: ["crm", "facturacion"],
  },
  {
    code: "activos",
    label: "Activos",
    group: "recursos",
    monthlyUF: 2,
    badge: "Inventario",
    description: "Gestiona inventario, equipamiento y activos operativos.",
    audience: "Operaciones y administración",
    includes: ["Inventario", "Seguimiento", "Control de activos"],
    recommendedWith: ["television", "social"],
  },
];

export const SELF_SERVE_ADDON_ORDER = SELF_SERVE_ADDON_CATALOG.map(item => item.code);

export function getSelfServeAddonCatalog() {
  return SELF_SERVE_ADDON_CATALOG.map(item => ({ ...item }));
}

export function getSelfServeAddon(code = "") {
  return SELF_SERVE_ADDON_CATALOG.find(item => item.code === code) || null;
}

export function isSelfServeAddonCode(code = "") {
  return SELF_SERVE_ADDON_CATALOG.some(item => item.code === code);
}

export function normalizeSelfServeSelection(selection = []) {
  const seen = new Set();
  return (Array.isArray(selection) ? selection : [])
    .filter(code => isSelfServeAddonCode(code))
    .filter(code => {
      if (seen.has(code)) return false;
      seen.add(code);
      return true;
    });
}

export function groupSelfServeAddons(selection = []) {
  const normalized = normalizeSelfServeSelection(selection);
  return SELF_SERVE_ADDON_GROUPS.map(group => ({
    ...group,
    items: normalized
      .map(code => getSelfServeAddon(code))
      .filter(item => item?.group === group.code),
  })).filter(group => group.items.length > 0);
}

export function buildSelfServePricingSnapshot(selection = []) {
  const selectedCodes = normalizeSelfServeSelection(selection);
  const addons = selectedCodes.map(code => getSelfServeAddon(code)).filter(Boolean);
  const addonSubtotalUF = addons.reduce((sum, item) => sum + Number(item.monthlyUF || 0), 0);
  const totalUF = Number(SELF_SERVE_BASE_PRODUCT.monthlyUF || 0) + addonSubtotalUF;

  return {
    currency: SELF_SERVE_PRICE_UNIT,
    base: {
      code: SELF_SERVE_BASE_PRODUCT.code,
      label: SELF_SERVE_BASE_PRODUCT.label,
      monthlyUF: Number(SELF_SERVE_BASE_PRODUCT.monthlyUF || 0),
    },
    addons,
    addonCount: addons.length,
    addonCodes: selectedCodes,
    addonSubtotalUF,
    totalUF,
  };
}

export function getSelfServeRecommendations(selection = []) {
  const selectedCodes = normalizeSelfServeSelection(selection);
  const selectedSet = new Set(selectedCodes);
  const recommendationMap = new Map();

  selectedCodes.forEach(code => {
    const addon = getSelfServeAddon(code);
    (addon?.recommendedWith || []).forEach(recommendedCode => {
      if (!selectedSet.has(recommendedCode) && isSelfServeAddonCode(recommendedCode)) {
        recommendationMap.set(recommendedCode, getSelfServeAddon(recommendedCode));
      }
    });
  });

  return Array.from(recommendationMap.values()).filter(Boolean);
}

