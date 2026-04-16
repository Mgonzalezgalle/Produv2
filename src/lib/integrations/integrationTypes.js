export const INTEGRATION_DOMAIN = {
  PAYMENTS: "payments",
  BILLING: "billing",
  SUPPORT: "support",
  CALENDAR: "calendar",
  EMAIL: "email",
  WEBHOOKS: "webhooks",
};

export const INTEGRATION_STAGE = {
  DISCOVERY: "discovery",
  NEGOTIATION: "negotiation",
  DESIGN: "design",
  READY_FOR_LAB: "ready_for_lab",
  ACTIVE_IN_LAB: "active_in_lab",
  READY_FOR_PRODUCTION: "ready_for_production",
  ACTIVE_IN_PRODUCTION: "active_in_production",
};

export const INTEGRATION_MODE = {
  EMBED: "embed",
  HOSTED_CHECKOUT: "hosted_checkout",
  API: "api",
  WEBHOOK: "webhook",
  SMTP: "smtp",
  OAUTH: "oauth",
};

export const INTEGRATION_CAPABILITY = {
  CHECKOUT: "checkout",
  PAYMENT_LINKS: "payment_links",
  RECURRING_PAYMENTS: "recurring_payments",
  ELECTRONIC_INVOICING: "electronic_invoicing",
  TICKETING: "ticketing",
  USER_IDENTIFICATION: "user_identification",
  OUTBOUND_EMAIL: "outbound_email",
  EVENT_SYNC: "event_sync",
  INBOUND_WEBHOOKS: "inbound_webhooks",
  PAYMENT_RECONCILIATION: "payment_reconciliation",
};

export function normalizeIntegrationRecord(record = {}) {
  return {
    id: String(record.id || "").trim(),
    name: String(record.name || "").trim(),
    domain: record.domain || null,
    provider: String(record.provider || record.id || "").trim(),
    stage: record.stage || INTEGRATION_STAGE.DISCOVERY,
    modes: Array.isArray(record.modes) ? record.modes.filter(Boolean) : [],
    capabilities: Array.isArray(record.capabilities) ? record.capabilities.filter(Boolean) : [],
    owner: String(record.owner || "platform").trim(),
    priority: Number(record.priority || 0),
    notes: String(record.notes || "").trim(),
    dependencies: Array.isArray(record.dependencies) ? record.dependencies.filter(Boolean) : [],
    envKeys: Array.isArray(record.envKeys) ? record.envKeys.filter(Boolean) : [],
  };
}

export function isIntegrationActive(record = {}) {
  return [
    INTEGRATION_STAGE.ACTIVE_IN_LAB,
    INTEGRATION_STAGE.READY_FOR_PRODUCTION,
    INTEGRATION_STAGE.ACTIVE_IN_PRODUCTION,
  ].includes(record.stage);
}
