import {
  INTEGRATION_CAPABILITY,
  INTEGRATION_DOMAIN,
  INTEGRATION_MODE,
  INTEGRATION_STAGE,
  isIntegrationActive,
  normalizeIntegrationRecord,
} from "./integrationTypes";

export const INTEGRATION_REGISTRY = [
  {
    id: "fintoc",
    name: "Fintoc Checkout",
    domain: INTEGRATION_DOMAIN.PAYMENTS,
    provider: "fintoc",
    stage: INTEGRATION_STAGE.NEGOTIATION,
    modes: [INTEGRATION_MODE.HOSTED_CHECKOUT, INTEGRATION_MODE.API, INTEGRATION_MODE.WEBHOOK],
    capabilities: [
      INTEGRATION_CAPABILITY.CHECKOUT,
      INTEGRATION_CAPABILITY.RECURRING_PAYMENTS,
      INTEGRATION_CAPABILITY.INBOUND_WEBHOOKS,
    ],
    owner: "growth_platform",
    priority: 100,
    notes: "Proveedor priorizado para self-serve acquisition y cobros recurrentes de Produ.",
    dependencies: ["self_serve_checkout_contract", "activation_state_machine", "server_side_checkout_endpoint"],
    envKeys: ["VITE_SELF_SERVE_UF_VALUE_CLP"],
  },
  {
    id: "freshdesk",
    name: "Freshdesk",
    domain: INTEGRATION_DOMAIN.SUPPORT,
    provider: "freshdesk",
    stage: INTEGRATION_STAGE.ACTIVE_IN_PRODUCTION,
    modes: [INTEGRATION_MODE.EMBED],
    capabilities: [
      INTEGRATION_CAPABILITY.TICKETING,
      INTEGRATION_CAPABILITY.USER_IDENTIFICATION,
    ],
    owner: "cx_ops",
    priority: 90,
    notes: "Canal de soporte activo; la prioridad es mantenerlo estable y bien contextualizado dentro del shell.",
    dependencies: ["authenticated_user_context", "active_company_context"],
    envKeys: [],
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    domain: INTEGRATION_DOMAIN.CALENDAR,
    provider: "google",
    stage: INTEGRATION_STAGE.READY_FOR_LAB,
    modes: [INTEGRATION_MODE.OAUTH, INTEGRATION_MODE.API],
    capabilities: [INTEGRATION_CAPABILITY.EVENT_SYNC],
    owner: "operations_platform",
    priority: 75,
    notes: "Base abierta para agenda operativa y coordinación por usuario con OAuth controlado desde Torre de Control.",
    dependencies: ["oauth_provider_layer", "calendar_event_adapter", "calendar_connection_state"],
    envKeys: ["VITE_GOOGLE_CALENDAR_MODE", "VITE_GOOGLE_CLIENT_ID", "VITE_GOOGLE_REDIRECT_URI", "VITE_GOOGLE_CALENDAR_SCOPES"],
  },
  {
    id: "transactional_email",
    name: "Correo Transaccional",
    domain: INTEGRATION_DOMAIN.EMAIL,
    provider: "resend",
    stage: INTEGRATION_STAGE.READY_FOR_LAB,
    modes: [INTEGRATION_MODE.API, INTEGRATION_MODE.WEBHOOK],
    capabilities: [INTEGRATION_CAPABILITY.OUTBOUND_EMAIL, INTEGRATION_CAPABILITY.INBOUND_WEBHOOKS],
    owner: "platform",
    priority: 80,
    notes: "Resend queda definido como proveedor base para onboarding, recuperación, notificaciones y flujos comerciales automatizados.",
    dependencies: ["notification_templates", "email_delivery_logs", "transactional_email_gateway"],
    envKeys: ["VITE_TRANSACTIONAL_EMAIL_MODE", "VITE_RESEND_FROM_EMAIL", "VITE_RESEND_FROM_NAME", "VITE_RESEND_REPLY_TO"],
  },
  {
    id: "electronic_invoicing",
    name: "Facturación Electrónica Bsale",
    domain: INTEGRATION_DOMAIN.BILLING,
    provider: "bsale",
    stage: INTEGRATION_STAGE.READY_FOR_LAB,
    modes: [INTEGRATION_MODE.API, INTEGRATION_MODE.WEBHOOK],
    capabilities: [INTEGRATION_CAPABILITY.ELECTRONIC_INVOICING, INTEGRATION_CAPABILITY.INBOUND_WEBHOOKS],
    owner: "finance_platform",
    priority: 95,
    notes: "Proveedor principal elegido para la futura capa de facturación electrónica de Produ.",
    dependencies: ["invoice_domain_contract", "billing_adapter", "server_side_credentials"],
    envKeys: ["VITE_BSALE_MODE", "VITE_BSALE_ACCESS_TOKEN", "VITE_BSALE_OFFICE_ID", "VITE_BSALE_PRICE_LIST_ID", "VITE_BSALE_DOCUMENT_TYPE_ID"],
  },
].map(normalizeIntegrationRecord);

export function getIntegrationRegistry() {
  return INTEGRATION_REGISTRY.slice().sort((a, b) => b.priority - a.priority);
}

export function getIntegrationsByDomain(domain) {
  return getIntegrationRegistry().filter((record) => record.domain === domain);
}

export function getIntegrationById(id) {
  const normalizedId = String(id || "").trim();
  return getIntegrationRegistry().find((record) => record.id === normalizedId) || null;
}

export function getActiveIntegrations() {
  return getIntegrationRegistry().filter(isIntegrationActive);
}

export function getIntegrationArchitectureSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    domains: Object.values(INTEGRATION_DOMAIN),
    activeCount: getActiveIntegrations().length,
    prioritizedIds: getIntegrationRegistry().map((record) => record.id),
    registry: getIntegrationRegistry(),
  };
}
