export function normalizeAuthEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

export function findActiveDomainUserByEmail(users = [], email = "") {
  const safeEmail = normalizeAuthEmail(email);
  return (Array.isArray(users) ? users : []).find(
    user => user?.active && normalizeAuthEmail(user?.email) === safeEmail,
  ) || null;
}

export function findActiveDomainUserById(users = [], userId = "") {
  return (Array.isArray(users) ? users : []).find(
    user => user?.active && user?.id === userId,
  ) || null;
}

export function resolveTenantForUser(user = null, empresas = [], storedSession = null) {
  if (!user) return null;
  const empresaId = user.role === "superadmin" ? storedSession?.empId : user.empId;
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
    canSwitchTenant: user?.role === "superadmin",
    authenticated: !!user,
  };
}

