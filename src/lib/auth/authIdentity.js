export function normalizeAuthEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

export function findActiveDomainUserByEmail(users = [], email = "") {
  const safeEmail = normalizeAuthEmail(email);
  return (Array.isArray(users) ? users : []).find(
    user => user?.active && normalizeAuthEmail(user?.email) === safeEmail,
  ) || null;
}

export function findActiveDomainUsersByEmail(users = [], email = "") {
  const safeEmail = normalizeAuthEmail(email);
  return (Array.isArray(users) ? users : []).filter(
    user => user?.active && normalizeAuthEmail(user?.email) === safeEmail,
  );
}

export function findActiveDomainUserById(users = [], userId = "") {
  return (Array.isArray(users) ? users : []).find(
    user => user?.active && user?.id === userId,
  ) || null;
}

export function buildMultiTenantDomainUser(primaryUser = null, users = []) {
  if (!primaryUser?.email) return primaryUser;
  const memberships = findActiveDomainUsersByEmail(users, primaryUser.email)
    .filter(user => user?.empId)
    .map(user => ({
      userId: user.id,
      empId: user.empId,
      role: user.role || primaryUser.role || "user",
      name: user.name || primaryUser.name || "",
      email: user.email || primaryUser.email || "",
    }));
  if (memberships.length <= 1) return primaryUser;
  const activeMembership = memberships.find(item => item.userId === primaryUser.id) || memberships[0];
  return {
    ...primaryUser,
    empId: activeMembership.empId,
    role: activeMembership.role,
    tenantMemberships: memberships,
    canSwitchTenant: true,
  };
}

export function resolveTenantForUser(user = null, empresas = [], storedSession = null) {
  if (!user) return null;
  const memberships = Array.isArray(user.tenantMemberships) ? user.tenantMemberships : [];
  const requestedEmpId = storedSession?.empId;
  const empresaId = user.role === "superadmin"
    ? requestedEmpId
    : (
        requestedEmpId && memberships.some(item => item.empId === requestedEmpId)
          ? requestedEmpId
          : user.empId
      );
  if (!empresaId) return null;
  return (Array.isArray(empresas) ? empresas : []).find(
    empresa => empresa.id === empresaId && empresa.active !== false,
  ) || null;
}

export function buildAuthSnapshot({ user = null, empresa = null, strategy = "local" } = {}) {
  return {
    strategy,
    userId: user?.id || "",
    role: user?.role || "",
    empId: empresa?.id || null,
    canSwitchTenant: user?.role === "superadmin" || !!user?.canSwitchTenant,
    authenticated: !!user,
  };
}
