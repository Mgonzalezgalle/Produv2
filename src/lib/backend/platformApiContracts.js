export const PLATFORM_API_CONTRACT_VERSION = "2026-04-platform-api-v1";

export const PLATFORM_API_CONTRACTS = {
  auth: {
    loginWithPassword: {
      method: "POST",
      path: "/api/auth/login",
      requestShape: ["email", "password"],
      responseShape: ["user", "error", "requiresSecondFactor", "updatedUser"],
    },
    restoreSession: {
      method: "GET",
      path: "/api/auth/session",
      requestShape: [],
      responseShape: ["user", "empresa", "clearSession"],
    },
    logout: {
      method: "POST",
      path: "/api/auth/logout",
      requestShape: [],
      responseShape: ["ok"],
    },
    requestPasswordReset: {
      method: "POST",
      path: "/api/auth/password/reset",
      requestShape: ["email"],
      responseShape: ["ok", "message", "revealedCode", "updatedUser"],
    },
  },
  tenants: {
    createPendingTenant: {
      method: "POST",
      path: "/api/tenants/bootstrap",
      requestShape: ["companyDraft", "requestedModules", "customerType", "teamSize"],
      responseShape: ["tenantDraft"],
    },
    syncLegacyTenant: {
      method: "POST",
      path: "/api/tenants/sync-legacy",
      requestShape: ["legacyEmpId", "empresa"],
      responseShape: ["tenant"],
    },
    activatePendingTenant: {
      method: "POST",
      path: "/api/tenants/activate",
      requestShape: ["leadId", "checkoutSessionId"],
      responseShape: ["tenant", "adminUser", "lead", "sessionRecord"],
    },
    planIdentityPromotions: {
      method: "POST",
      path: "/api/tenants/:tenantId/identity/promotion-plan",
      requestShape: ["tenantId"],
      responseShape: ["promotionPlans"],
    },
    prepareIdentityMembershipBlueprints: {
      method: "POST",
      path: "/api/tenants/:tenantId/identity/membership-blueprints",
      requestShape: ["tenantId"],
      responseShape: ["membershipBlueprints"],
    },
    prepareMembershipTransitionQueue: {
      method: "POST",
      path: "/api/tenants/:tenantId/identity/membership-queue",
      requestShape: ["tenantId"],
      responseShape: ["membershipTransitionQueue"],
    },
  },
  checkout: {
    confirmPayment: {
      method: "POST",
      path: "/api/billing/self-serve/payment/confirm",
      requestShape: ["leadId", "checkoutSessionId"],
      responseShape: ["sessionRecord", "lead"],
    },
  },
  billing: {
    getDocumentStatus: {
      method: "GET",
      path: "/api/billing/documents/:documentId/status",
      requestShape: ["documentId"],
      responseShape: ["sessionRecord", "externalSync"],
    },
  },
};

export function getPlatformApiContracts() {
  return PLATFORM_API_CONTRACTS;
}
