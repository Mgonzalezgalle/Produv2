export const API_CONTRACT_VERSION = "2026-04-foundation";

export const API_ROUTE_GROUPS = {
  auth: {
    label: "Auth",
    basePath: "/api/auth",
    routes: [
      {
        method: "POST",
        path: "/login",
        action: "login_with_password",
        requestShape: ["email", "password", "tenantCode?"],
        responseShape: ["session", "user", "tenant", "mfa"],
      },
      {
        method: "POST",
        path: "/mfa/verify",
        action: "mfa_totp_challenge",
        requestShape: ["sessionId", "code"],
        responseShape: ["session", "user", "tenant"],
      },
      {
        method: "POST",
        path: "/password/reset",
        action: "password_reset",
        requestShape: ["email"],
        responseShape: ["accepted", "ticketId"],
      },
    ],
  },
  tenants: {
    label: "Tenants",
    basePath: "/api/tenants",
    routes: [
      {
        method: "GET",
        path: "/:tenantId",
        action: "tenant_settings",
        requestShape: ["tenantId"],
        responseShape: ["tenant"],
      },
      {
        method: "PATCH",
        path: "/:tenantId",
        action: "tenant_settings",
        requestShape: ["tenantId", "patch"],
        responseShape: ["tenant"],
      },
      {
        method: "POST",
        path: "/self-serve/activate",
        action: "tenant_activation",
        requestShape: ["leadId", "checkoutSessionId"],
        responseShape: ["tenant", "activationState"],
      },
      {
        method: "POST",
        path: "/:tenantId/identity/promotion-plan",
        action: "tenant_identity_planning",
        requestShape: ["tenantId"],
        responseShape: ["promotionPlans"],
      },
      {
        method: "POST",
        path: "/:tenantId/identity/membership-blueprints",
        action: "tenant_identity_planning",
        requestShape: ["tenantId"],
        responseShape: ["membershipBlueprints"],
      },
      {
        method: "POST",
        path: "/:tenantId/identity/membership-queue",
        action: "tenant_identity_planning",
        requestShape: ["tenantId"],
        responseShape: ["membershipTransitionQueue"],
      },
    ],
  },
  users: {
    label: "Users",
    basePath: "/api/users",
    routes: [
      {
        method: "POST",
        path: "",
        action: "create_user",
        requestShape: ["tenantId", "name", "email", "role", "active", "crew?"],
        responseShape: ["user"],
      },
      {
        method: "PATCH",
        path: "/:userId",
        action: "update_user",
        requestShape: ["userId", "patch"],
        responseShape: ["user"],
      },
      {
        method: "POST",
        path: "/:userId/reset-access",
        action: "reset_access",
        requestShape: ["userId"],
        responseShape: ["temporaryAccessTicket"],
      },
      {
        method: "DELETE",
        path: "/:userId",
        action: "deactivate_user",
        requestShape: ["userId"],
        responseShape: ["ok"],
      },
    ],
  },
  permissions: {
    label: "Permissions",
    basePath: "/api/permissions",
    routes: [
      {
        method: "GET",
        path: "/roles/:tenantId",
        action: "role_catalog",
        requestShape: ["tenantId"],
        responseShape: ["roles"],
      },
      {
        method: "POST",
        path: "/roles/:tenantId",
        action: "custom_role_management",
        requestShape: ["tenantId", "label", "permissions", "badge", "color"],
        responseShape: ["role"],
      },
      {
        method: "PATCH",
        path: "/roles/:tenantId/:roleKey",
        action: "custom_role_management",
        requestShape: ["tenantId", "roleKey", "patch"],
        responseShape: ["role"],
      },
      {
        method: "DELETE",
        path: "/roles/:tenantId/:roleKey",
        action: "custom_role_management",
        requestShape: ["tenantId", "roleKey"],
        responseShape: ["ok"],
      },
    ],
  },
  checkout: {
    label: "Checkout",
    basePath: "/api/billing/self-serve",
    routes: [
      {
        method: "POST",
        path: "/checkout-intent",
        action: "create_checkout_intent",
        requestShape: ["lead", "pricingSnapshot", "activationFlow"],
        responseShape: ["checkoutIntent"],
      },
      {
        method: "POST",
        path: "/fintoc/session",
        action: "create_fintoc_session",
        requestShape: ["checkoutIntentId"],
        responseShape: ["provider", "sessionId", "redirectUrl", "paymentState"],
      },
      {
        method: "POST",
        path: "/webhooks/fintoc",
        action: "checkout_webhook",
        requestShape: ["event"],
        responseShape: ["accepted"],
      },
    ],
  },
  billing: {
    label: "Billing",
    basePath: "/api/billing/documents",
    routes: [
      {
        method: "POST",
        path: "/:documentId/emit",
        action: "manual_document_emission",
        requestShape: ["documentId", "provider"],
        responseShape: ["syncSession", "externalSync"],
      },
      {
        method: "GET",
        path: "/:documentId/status",
        action: "document_status_sync",
        requestShape: ["documentId"],
        responseShape: ["externalSync"],
      },
      {
        method: "POST",
        path: "/webhooks/bsale",
        action: "provider_adapter_bsale",
        requestShape: ["event"],
        responseShape: ["accepted"],
      },
    ],
  },
  calendar: {
    label: "Calendar",
    basePath: "/api/integrations/google-calendar",
    routes: [
      {
        method: "POST",
        path: "/oauth/start",
        action: "google_calendar_oauth_start",
        requestShape: ["tenantId", "userId", "userEmail", "redirectTo?", "scopes?"],
        responseShape: ["authUrl", "state", "redirectUri", "scopes"],
      },
      {
        method: "POST",
        path: "/oauth/callback",
        action: "google_calendar_oauth_callback",
        requestShape: ["code", "state"],
        responseShape: ["connection"],
      },
      {
        method: "POST",
        path: "/users/:userId/connection",
        action: "google_calendar_connection_upsert",
        requestShape: ["userId", "connection"],
        responseShape: ["user"],
      },
      {
        method: "DELETE",
        path: "/users/:userId/connection",
        action: "google_calendar_connection_delete",
        requestShape: ["userId"],
        responseShape: ["user"],
      },
      {
        method: "GET",
        path: "/tenants/:tenantId/connections",
        action: "google_calendar_connection_list",
        requestShape: ["tenantId"],
        responseShape: ["connections"],
      },
      {
        method: "POST",
        path: "/events",
        action: "google_calendar_event_create",
        requestShape: ["calendarId?", "refreshToken", "summary", "description?", "startDateTime", "endDateTime", "timeZone?", "attendees?", "addMeet?"],
        responseShape: ["event"],
      },
    ],
  },
};

export function getApiRouteGroups() {
  return Object.entries(API_ROUTE_GROUPS).map(([id, group]) => ({ id, ...group }));
}

export function getApiRoutesFlat() {
  return getApiRouteGroups().flatMap(group =>
    group.routes.map(route => ({
      groupId: group.id,
      groupLabel: group.label,
      basePath: group.basePath,
      fullPath: `${group.basePath}${route.path}`,
      ...route,
    })),
  );
}
