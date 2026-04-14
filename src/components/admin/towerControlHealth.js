export function getRemoteProvisionedModules(snapshot = {}) {
  const fromModules = snapshot?.modules?.provisioned;
  const fromTenant = snapshot?.tenant?.requested_modules;
  const fromLegacy = snapshot?.requestedModules || snapshot?.addons;
  const source = Array.isArray(fromModules)
    ? fromModules
    : Array.isArray(fromTenant)
      ? fromTenant
      : Array.isArray(fromLegacy)
        ? fromLegacy
        : [];
  return Array.from(new Set(source.filter(Boolean)));
}

export function getRemoteBsaleSnapshot(snapshot = {}) {
  const source = snapshot?.integrations?.bsale || snapshot?.integrationConfigs?.bsale?.sandbox || snapshot?.tenant?.bsale || null;
  if (!source) return null;
  return {
    governanceMode: source.governanceMode || source.mode || "disabled",
    status: source.status || "draft",
    officeId: source.officeId || "",
    documentTypeId: source.documentTypeId || "",
    priceListId: source.priceListId || "",
    tokenConfigured: Boolean(source.tokenConfigured || source.token),
  };
}

export function buildTenantHealth(emp, users = [], snapshot = {}) {
  const localUsers = (users || []).filter(user => user.empId === emp?.id).length;
  const localRoles = Array.isArray(emp?.customRoles) ? emp.customRoles.length : 0;
  const remoteUsers = Array.isArray(snapshot?.userShadows) ? snapshot.userShadows.length : 0;
  const remoteRoles = Array.isArray(snapshot?.customRoles) ? snapshot.customRoles.length : 0;
  const remoteModules = getRemoteProvisionedModules(snapshot);
  const remoteBsale = getRemoteBsaleSnapshot(snapshot);
  const foundationReady = Boolean(snapshot?.tenant);
  const identityAligned = foundationReady && localUsers === remoteUsers && localRoles === remoteRoles;
  return {
    foundationReady,
    identityAligned,
    remoteUsers,
    remoteRoles,
    remoteModules,
    remoteBsale,
  };
}
