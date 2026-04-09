export const SYSTEM_MESSAGE_PRESETS = [
  {
    id: "maintenance",
    label: "Mantenimiento",
    title: "Mantenimiento programado",
    body: "**Hola equipo**\n\nTendremos una ventana de mantenimiento el **[fecha]** entre **[hora inicio]** y **[hora fin]**.\n\nDurante ese período pueden presentarse intermitencias leves.\n\nGracias por su comprensión.",
  },
  {
    id: "incident",
    label: "Incidencia",
    title: "Incidencia en revisión",
    body: "**Estamos revisando una incidencia** reportada por el equipo.\n\n- Módulo afectado: [módulo]\n- Estado: En análisis\n- Próxima actualización: [hora]\n\nLes avisaremos apenas quede resuelta.",
  },
  {
    id: "feature",
    label: "Nueva función",
    title: "Nueva funcionalidad disponible",
    body: "**Ya activamos una mejora nueva en Produ**.\n\n- Disponible desde hoy\n- Impacta: [módulo / flujo]\n- Recomendación: revisar con el equipo interno\n\nSi necesitan apoyo, nos escriben por este mismo canal.",
  },
  {
    id: "billing",
    label: "Cobranza",
    title: "Recordatorio administrativo",
    body: "**Hola equipo**\n\nLes compartimos este recordatorio administrativo:\n\n- Documento: [tipo / número]\n- Fecha relevante: [fecha]\n- Acción sugerida: [acción]\n\nQuedamos atentos si necesitan apoyo.",
  },
];

export const THEME_PRESETS = {
  clasico: {
    label: "Produ Clásico",
    description: "La identidad original de Produ, limpia y reconocible.",
    dark: { mode: "dark", bg: "#080809", surface: "#0f0f11", card: "#141416", border: "#1e1e24", accent: "#00d4e8", accent2: "#00b8c8", white: "#f4f4f6", gray: "#7c7c8a", sidebarBg: "#0f172a", sidebarPanel: "#132033", sidebarText: "#e5f5ff", sidebarMuted: "#9fb3c8" },
    light: { mode: "light", bg: "#eef2f7", surface: "#ffffff", card: "#ffffff", border: "#d7dee8", accent: "#00b4cc", accent2: "#0097ad", white: "#0f172a", gray: "#475569", sidebarBg: "#0f172a", sidebarPanel: "#132033", sidebarText: "#e5f5ff", sidebarMuted: "#9fb3c8" },
  },
  editorial: {
    label: "Editorial",
    description: "Más contraste y tono de sala de edición.",
    dark: { mode: "dark", bg: "#0a0a0e", surface: "#101119", card: "#171924", border: "#252838", accent: "#4ade80", accent2: "#16a34a", white: "#f5f7fb", gray: "#94a3b8", sidebarBg: "#1b1020", sidebarPanel: "#28172f", sidebarText: "#f8eefb", sidebarMuted: "#c8b0d1" },
    light: { mode: "light", bg: "#f4f6f8", surface: "#ffffff", card: "#ffffff", border: "#d8dee8", accent: "#15803d", accent2: "#166534", white: "#111827", gray: "#526072", sidebarBg: "#1b1020", sidebarPanel: "#28172f", sidebarText: "#f8eefb", sidebarMuted: "#c8b0d1" },
  },
  corporativo: {
    label: "Corporativo",
    description: "Más sobrio y ejecutivo para clientes e instancias formales.",
    dark: { mode: "dark", bg: "#081018", surface: "#0d1722", card: "#13202f", border: "#213348", accent: "#38bdf8", accent2: "#0284c7", white: "#f3f7fb", gray: "#8ca0b7", sidebarBg: "#10233f", sidebarPanel: "#173155", sidebarText: "#edf5ff", sidebarMuted: "#abc1d9" },
    light: { mode: "light", bg: "#eef4f8", surface: "#ffffff", card: "#ffffff", border: "#d3dfe8", accent: "#0369a1", accent2: "#075985", white: "#0f172a", gray: "#4b5563", sidebarBg: "#10233f", sidebarPanel: "#173155", sidebarText: "#edf5ff", sidebarMuted: "#abc1d9" },
  },
  minimal: {
    label: "Minimal",
    description: "Más neutral, ordenado y con menor ruido visual.",
    dark: { mode: "dark", bg: "#0b0b0c", surface: "#121214", card: "#19191c", border: "#2a2a2f", accent: "#e5e7eb", accent2: "#9ca3af", white: "#fafafa", gray: "#9ca3af", sidebarBg: "#151515", sidebarPanel: "#1d1d1f", sidebarText: "#f5f5f5", sidebarMuted: "#b0b0b4" },
    light: { mode: "light", bg: "#f7f7f8", surface: "#ffffff", card: "#ffffff", border: "#dddddf", accent: "#374151", accent2: "#111827", white: "#111111", gray: "#5b6472", sidebarBg: "#151515", sidebarPanel: "#1d1d1f", sidebarText: "#f5f5f5", sidebarMuted: "#b0b0b4" },
  },
};
