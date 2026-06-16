export const BASE_MODULE_IDS = ["clientes"];

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
    next.delete("television");
    next.delete("social");
  }
  BASE_MODULE_IDS.forEach(moduleId => next.delete(moduleId));
  return Array.from(next);
}
