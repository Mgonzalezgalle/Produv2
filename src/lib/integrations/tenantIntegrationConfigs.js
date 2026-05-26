export function resolveTenantIntegrationSource({
  hasTenantCredentials = false,
  hasEnvironmentCredentials = false,
  tenantCanEdit = false,
} = {}) {
  if (hasTenantCredentials) return tenantCanEdit ? "tenant" : "governed";
  if (hasEnvironmentCredentials) return "environment";
  return "unset";
}

export function buildTenantBsaleConfigState(current = {}, {
  governanceMode = "disabled",
  tenantCanEdit = false,
  envConfig = {},
} = {}) {
  const hasTenantToken = Boolean(current?.token);
  return {
    mode: governanceMode,
    status: current?.status || "draft",
    token: current?.token || "",
    officeId: current?.officeId || "",
    documentTypeId: current?.documentTypeId || "",
    priceListId: current?.priceListId || "",
    source: resolveTenantIntegrationSource({
      hasTenantCredentials: hasTenantToken,
      hasEnvironmentCredentials: Boolean(envConfig?.token),
      tenantCanEdit,
    }),
    governed: governanceMode !== "disabled",
    tenantCanEdit,
  };
}

export function buildTenantMercadoPagoConfigState(current = {}, {
  governanceMode = "disabled",
  tenantCanEdit = false,
  envConfig = {},
} = {}) {
  const hasTenantCredentials = Boolean(current?.publicKey || current?.accessToken || current?.accessTokenConfigured);
  const effectiveGovernanceMode = governanceMode !== "disabled" || hasTenantCredentials
    ? (governanceMode === "disabled" ? "api" : governanceMode)
    : "disabled";
  return {
    mode: effectiveGovernanceMode,
    status: current?.status || "disconnected",
    credentialEnvironment: current?.credentialEnvironment || "production",
    marketplace: current?.marketplace || envConfig?.marketplace || "MLC",
    sellerAccountLabel: current?.sellerAccountLabel || "",
    successUrl: current?.successUrl || "",
    failureUrl: current?.failureUrl || "",
    pendingUrl: current?.pendingUrl || "",
    notificationUrl: current?.notificationUrl || "",
    clientId: current?.clientId || "",
    clientSecret: "",
    clientSecretConfigured: current?.clientSecretConfigured === true || Boolean(current?.clientSecret),
    publicKey: current?.publicKey || "",
    accessToken: "",
    accessTokenConfigured: current?.accessTokenConfigured === true || Boolean(current?.accessToken),
    webhookSecret: current?.webhookSecret || "",
    defaultExpirationDays: current?.defaultExpirationDays || "7",
    enablePaymentLinksInCollection: current?.enablePaymentLinksInCollection !== false,
    source: resolveTenantIntegrationSource({
      hasTenantCredentials,
      hasEnvironmentCredentials: Boolean(envConfig?.appId || envConfig?.publicKey),
      tenantCanEdit: tenantCanEdit || hasTenantCredentials,
    }),
    governed: effectiveGovernanceMode !== "disabled",
    tenantCanEdit: tenantCanEdit || hasTenantCredentials,
  };
}

export function mergeTenantIntegrationConfig(empresa = {}, provider = "", environment = "tenant", nextConfig = {}, providerPatch = {}) {
  return {
    ...(empresa?.integrationConfigs || {}),
    [provider]: {
      ...((empresa?.integrationConfigs || {})[provider] || {}),
      ...(providerPatch && typeof providerPatch === "object" ? providerPatch : {}),
      [environment]: nextConfig,
    },
  };
}

export async function persistTenantIntegrationConfig({
  empresa = null,
  empresas = [],
  saveEmpresas = null,
  platformServices = null,
  provider = "",
  environment = "tenant",
  nextConfig = {},
  providerPatch = {},
  credentialSnapshot = null,
  auditAction = "",
  auditPayload = {},
} = {}) {
  if (!empresa?.id || typeof saveEmpresas !== "function" || !provider) {
    throw new Error("Faltan datos para persistir la integración del tenant.");
  }
  const nextIntegrationConfigs = mergeTenantIntegrationConfig(empresa, provider, environment, nextConfig, providerPatch);
  await saveEmpresas((Array.isArray(empresas) ? empresas : []).map(em => (
    em.id === empresa.id ? { ...em, integrationConfigs: nextIntegrationConfigs } : em
  )));
  if (platformServices?.upsertIntegrationCredentialSnapshot && credentialSnapshot) {
    await platformServices.upsertIntegrationCredentialSnapshot(empresa.id, credentialSnapshot).catch(() => null);
  }
  if (platformServices?.appendSyncAuditLog && auditAction) {
    await platformServices.appendSyncAuditLog(
      empresa.id,
      auditAction,
      "integration_config",
      `${provider}:${environment}`,
      auditPayload && typeof auditPayload === "object" ? auditPayload : {},
    ).catch(() => null);
  }
  return nextIntegrationConfigs;
}
