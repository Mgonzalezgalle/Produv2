import { useEffect } from "react";
import { PLATFORM_API_MODES } from "../lib/backend/platformApiMode";

function buildUserShadow(user = {}) {
  return {
    id: user?.id || "",
    empId: user?.empId || "",
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "viewer",
    active: user?.active !== false,
    isCrew: user?.isCrew === true,
    crewRole: user?.crewRole || "",
  };
}

function buildIdentityCandidate(user = {}) {
  return {
    id: user?.id || "",
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "viewer",
    status: user?.active === false ? "inactive" : "pending",
    active: user?.active !== false,
    isCrew: user?.isCrew === true,
    crewRole: user?.crewRole || "",
  };
}

export function useLabTenantUserShadowSync({
  curEmp,
  users,
  platformApiMode,
  platformServices,
  foundationTenantReady = false,
}) {
  useEffect(() => {
    if (platformApiMode !== PLATFORM_API_MODES.SUPABASE) return;
    if (!foundationTenantReady) return;
    if (!curEmp?.id || !platformServices?.syncTenantUserShadows) return;

    const tenantUsers = (Array.isArray(users) ? users : [])
      .filter(user => user?.empId === curEmp.id)
      .map(buildUserShadow);
    const identityCandidates = (Array.isArray(users) ? users : [])
      .filter(user => user?.empId === curEmp.id)
      .map(buildIdentityCandidate);

    Promise.allSettled([
      Promise.resolve(platformServices.syncTenantUserShadows(curEmp.id, tenantUsers)),
      platformServices?.syncIdentityCandidates
        ? Promise.resolve(platformServices.syncIdentityCandidates(curEmp.id, identityCandidates))
        : Promise.resolve(null),
    ]).catch(() => {});
  }, [
    curEmp?.id,
    JSON.stringify((Array.isArray(users) ? users : []).filter(user => user?.empId === curEmp?.id).map(user => ({
      id: user?.id,
      name: user?.name,
      email: user?.email,
      role: user?.role,
      active: user?.active,
      isCrew: user?.isCrew,
      crewRole: user?.crewRole,
    }))),
    platformApiMode,
    platformServices,
    foundationTenantReady,
  ]);
}
