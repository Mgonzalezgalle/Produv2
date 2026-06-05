import { normalizeTenantIndustryProfile } from "../industry/tenantVocabulary";
import { buildTenantMercadoPagoConfigState } from "../integrations/tenantIntegrationConfigs";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasText(value = "") {
  return String(value || "").trim().length > 0;
}

function getEnabledPortalCount(collection = [], portalKey = "portal") {
  return asArray(collection).filter(item => item?.[portalKey]?.enabled === true).length;
}

export function normalizeTenantRuntimeConfig(empresa = {}) {
  const industryProfile = normalizeTenantIndustryProfile(empresa?.industryProfile || {});
  const addons = Array.from(new Set(asArray(empresa?.addons).filter(Boolean)));
  const integrationConfigs = empresa?.integrationConfigs && typeof empresa.integrationConfigs === "object"
    ? empresa.integrationConfigs
    : {};
  const mercadoPago = buildTenantMercadoPagoConfigState(integrationConfigs?.mercadoPago?.tenant || {}, {
    governanceMode: integrationConfigs?.mercadoPago?.governanceMode || integrationConfigs?.mercadoPago?.mode || "disabled",
    tenantCanEdit: true,
  });

  return {
    tenantId: empresa?.id || "",
    tenantCode: empresa?.tenantCode || "",
    active: empresa?.active !== false,
    identity: {
      name: empresa?.nombre || "",
      rut: empresa?.rut || "",
      email: empresa?.ema || "",
      phone: empresa?.tel || "",
      color: empresa?.color || "",
      logoConfigured: hasText(empresa?.logo),
    },
    industryProfile,
    addons,
    portals: {
      contentClientsEnabled: getEnabledPortalCount(empresa?.clientes || [], "portal"),
      financeClientsEnabled: getEnabledPortalCount(empresa?.clientes || [], "financePortal"),
      financeProvidersEnabled: getEnabledPortalCount(empresa?.treasuryProviders || [], "financePortal"),
    },
    integrations: {
      mercadoPago,
      mercadoPagoReady: mercadoPago.status === "connected" && mercadoPago.accessTokenConfigured === true,
      bsaleReady: integrationConfigs?.bsale?.sandbox?.status === "connected" || integrationConfigs?.bsale?.production?.status === "connected",
      diioReady: integrationConfigs?.diio?.tenant?.status === "connected" || integrationConfigs?.diio?.tenant?.status === "configured",
    },
    billing: {
      status: empresa?.billingStatus || "Pendiente",
      monthly: Number(empresa?.billingMonthly || 0),
      currency: empresa?.billingCurrency || "UF",
      dueDay: empresa?.billingDueDay || "",
    },
  };
}

export function buildTenantReadiness(empresa = {}, users = [], snapshot = {}) {
  const runtime = normalizeTenantRuntimeConfig(empresa);
  const tenantUsers = asArray(users).filter(user => user.empId === empresa?.id);
  const issues = [];
  const checks = [
    {
      id: "identity",
      label: "Identidad base",
      ready: hasText(runtime.identity.name) && hasText(runtime.identity.rut) && hasText(runtime.identity.email),
      issue: "Completar nombre, RUT y correo principal del tenant.",
    },
    {
      id: "branding",
      label: "Marca",
      ready: hasText(runtime.identity.color),
      issue: "Definir color corporativo para mantener una experiencia premium.",
    },
    {
      id: "users",
      label: "Usuarios",
      ready: tenantUsers.length > 0 || asArray(snapshot?.userShadows).length > 0,
      issue: "Crear al menos un usuario operativo asociado al tenant.",
    },
    {
      id: "modules",
      label: "Módulos",
      ready: runtime.addons.length > 0,
      issue: "Activar los módulos que esta empresa usará.",
    },
    {
      id: "industry",
      label: "Preset industria",
      ready: hasText(runtime.industryProfile?.presetId),
      issue: "Definir si el tenant usa lenguaje productora o multi industria.",
    },
    {
      id: "billing",
      label: "Cartera",
      ready: runtime.billing.status === "Al día" || runtime.billing.monthly > 0,
      issue: "Configurar estado comercial, valor mensual o seguimiento de cartera.",
    },
    {
      id: "foundation",
      label: "Foundation remota",
      ready: Boolean(snapshot?.tenant),
      issue: "Sincronizar el tenant con la foundation remota.",
    },
  ];

  checks.forEach(check => {
    if (!check.ready) issues.push(check.issue);
  });

  const readyCount = checks.filter(check => check.ready).length;
  const score = Math.round((readyCount / checks.length) * 100);
  const level = score >= 86 ? "ready" : score >= 58 ? "attention" : "risk";

  return {
    runtime,
    score,
    level,
    checks,
    issues,
    summary: `${readyCount}/${checks.length} pilares listos`,
  };
}
