export const TENANT_VOCABULARY_MODULES = [
  { id: "clientes", baseSingular: "Cliente", basePlural: "Clientes", baseNew: "Nuevo cliente", baseDescription: "Personas o empresas con las que trabajas." },
  { id: "producciones", baseSingular: "Proyecto", basePlural: "Proyectos", baseNew: "Nuevo proyecto", baseDescription: "Agrupa trabajo, fechas, responsables y avance." },
  { id: "programas", baseSingular: "Producción", basePlural: "Producciones", baseNew: "Nueva producción", baseDescription: "Producciones audiovisuales, episodios y entregas." },
  { id: "contenidos", baseSingular: "Contenido", basePlural: "Contenidos", baseNew: "Nuevo contenido", baseDescription: "Piezas, entregables y aprobaciones." },
  { id: "crm", baseSingular: "Oportunidad", basePlural: "CRM", baseNew: "Nueva oportunidad", baseDescription: "Seguimiento comercial y pipeline." },
  { id: "auspiciadores", baseSingular: "Auspiciador", basePlural: "Auspiciadores", baseNew: "Nuevo auspiciador", baseDescription: "Marcas o sponsors vinculados a clientes." },
  { id: "presupuestos", baseSingular: "Presupuesto", basePlural: "Presupuestos", baseNew: "Nuevo presupuesto", baseDescription: "Propuestas comerciales y aprobaciones." },
  { id: "facturacion", baseSingular: "Documento", basePlural: "Facturación", baseNew: "Nuevo documento", baseDescription: "Documentos emitidos y cobranza." },
  { id: "tesoreria", baseSingular: "Movimiento", basePlural: "Tesorería", baseNew: "Nuevo movimiento", baseDescription: "Cuentas por cobrar, pagar y pagos." },
  { id: "contratos", baseSingular: "Contrato", basePlural: "Contratos", baseNew: "Nuevo contrato", baseDescription: "Acuerdos y documentos legales." },
  { id: "activos", baseSingular: "Activo", basePlural: "Activos", baseNew: "Nuevo activo", baseDescription: "Inventario, equipos y recursos." },
  { id: "crew", baseSingular: "Persona", basePlural: "Equipo / Crew", baseNew: "Nueva persona", baseDescription: "Equipo interno, externo o colaboradores." },
];

export const TENANT_INDUSTRY_PRESETS = {
  productora: {
    id: "productora",
    name: "Productora audiovisual",
    description: "Mantiene el lenguaje actual de Produ para productoras audiovisuales.",
    vocabulary: Object.fromEntries(TENANT_VOCABULARY_MODULES.map(module => [module.id, {
      singular: module.baseSingular,
      plural: module.basePlural,
      newLabel: module.baseNew,
      description: module.baseDescription,
      listLabel: module.basePlural,
      emailAlias: module.baseSingular.toLowerCase(),
    }])),
  },
  multi_industria: {
    id: "multi_industria",
    name: "Multi industria",
    description: "Adapta Produ para servicios, operaciones, consultoría, agencias o equipos internos.",
    vocabulary: {
      clientes: { singular: "Cliente", plural: "Clientes", newLabel: "Nuevo cliente", description: "Personas o empresas con las que trabajas.", listLabel: "Clientes", emailAlias: "cliente" },
      producciones: { singular: "Trabajo", plural: "Trabajos", newLabel: "Nuevo trabajo", description: "Ordena servicios, responsables, fechas y avance.", listLabel: "Trabajos", emailAlias: "trabajo" },
      programas: { singular: "Operación", plural: "Operaciones", newLabel: "Nueva operación", description: "Agrupa procesos o líneas de trabajo activas.", listLabel: "Operaciones", emailAlias: "operación" },
      contenidos: { singular: "Entregable", plural: "Entregables", newLabel: "Nuevo entregable", description: "Piezas, archivos o hitos que deben revisarse o aprobarse.", listLabel: "Entregables", emailAlias: "entregable" },
      crm: { singular: "Oportunidad", plural: "Comercial", newLabel: "Nueva oportunidad", description: "Seguimiento comercial y oportunidades abiertas.", listLabel: "Oportunidades", emailAlias: "oportunidad" },
      auspiciadores: { singular: "Cuenta asociada", plural: "Cuentas asociadas", newLabel: "Nueva cuenta asociada", description: "Relaciones comerciales vinculadas a un cliente principal.", listLabel: "Cuentas asociadas", emailAlias: "cuenta asociada" },
      presupuestos: { singular: "Cotización", plural: "Cotizaciones", newLabel: "Nueva cotización", description: "Propuestas comerciales listas para enviar y aprobar.", listLabel: "Cotizaciones", emailAlias: "cotización" },
      facturacion: { singular: "Documento", plural: "Documentos", newLabel: "Nuevo documento", description: "Documentos emitidos, vencimientos y cobranza.", listLabel: "Documentos", emailAlias: "documento" },
      tesoreria: { singular: "Pago", plural: "Finanzas", newLabel: "Nuevo pago", description: "Cuentas por cobrar, pagar y pagos asociados.", listLabel: "Finanzas", emailAlias: "pago" },
      contratos: { singular: "Acuerdo", plural: "Acuerdos", newLabel: "Nuevo acuerdo", description: "Contratos, acuerdos y documentación de respaldo.", listLabel: "Acuerdos", emailAlias: "acuerdo" },
      activos: { singular: "Recurso", plural: "Recursos", newLabel: "Nuevo recurso", description: "Inventario, recursos y activos de operación.", listLabel: "Recursos", emailAlias: "recurso" },
      crew: { singular: "Colaborador", plural: "Equipo", newLabel: "Nuevo colaborador", description: "Personas internas, externas o colaboradores.", listLabel: "Equipo", emailAlias: "colaborador" },
    },
  },
};

function cleanText(value = "", fallback = "") {
  const safe = String(value || "").trim();
  return safe || fallback;
}

export function buildVocabularyFromPreset(presetId = "productora") {
  const preset = TENANT_INDUSTRY_PRESETS[presetId] || TENANT_INDUSTRY_PRESETS.productora;
  return Object.fromEntries(TENANT_VOCABULARY_MODULES.map(module => {
    const custom = preset.vocabulary?.[module.id] || {};
    return [module.id, {
      singular: cleanText(custom.singular, module.baseSingular),
      plural: cleanText(custom.plural, module.basePlural),
      newLabel: cleanText(custom.newLabel, module.baseNew),
      description: cleanText(custom.description, module.baseDescription),
      listLabel: cleanText(custom.listLabel, custom.plural || module.basePlural),
      emailAlias: cleanText(custom.emailAlias, module.baseSingular.toLowerCase()),
    }];
  }));
}

export function normalizeTenantIndustryProfile(profile = {}) {
  const presetId = TENANT_INDUSTRY_PRESETS[profile?.presetId] ? profile.presetId : "productora";
  const presetVocabulary = buildVocabularyFromPreset(presetId);
  const customVocabulary = profile?.vocabulary && typeof profile.vocabulary === "object" ? profile.vocabulary : {};
  return {
    presetId,
    mode: profile?.mode || presetId,
    enabled: profile?.enabled !== false,
    updatedAt: profile?.updatedAt || "",
    vocabulary: Object.fromEntries(TENANT_VOCABULARY_MODULES.map(module => {
      const base = presetVocabulary[module.id] || {};
      const custom = customVocabulary[module.id] || {};
      return [module.id, {
        singular: cleanText(custom.singular, base.singular || module.baseSingular),
        plural: cleanText(custom.plural, base.plural || module.basePlural),
        newLabel: cleanText(custom.newLabel, base.newLabel || module.baseNew),
        description: cleanText(custom.description, base.description || module.baseDescription),
        listLabel: cleanText(custom.listLabel, custom.plural || base.listLabel || module.basePlural),
        emailAlias: cleanText(custom.emailAlias, custom.singular || base.emailAlias || module.baseSingular.toLowerCase()),
      }];
    })),
  };
}

export function getTenantVocabularyEntry(empresa = {}, moduleId = "") {
  const profile = normalizeTenantIndustryProfile(empresa?.industryProfile || {});
  return profile.vocabulary?.[moduleId] || buildVocabularyFromPreset("productora")?.[moduleId] || null;
}

export function getTenantModuleLabel(empresa = {}, moduleId = "", fallback = "") {
  return getTenantVocabularyEntry(empresa, moduleId)?.plural || fallback;
}
