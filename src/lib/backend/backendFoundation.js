export const BACKEND_FOUNDATION_VERSION = "v1";

export const PLATFORM_DOMAINS = {
  auth: {
    id: "auth",
    label: "Auth y sesión",
    priority: 1,
    status: "planned",
    owner: "backend",
    description: "Login, MFA, refresh de sesión, recuperación de acceso y auditoría de identidad.",
    capabilities: [
      "login_with_password",
      "mfa_totp_challenge",
      "password_reset",
      "session_refresh",
      "auth_audit_log",
    ],
  },
  tenants: {
    id: "tenants",
    label: "Tenants y empresas",
    priority: 1,
    status: "planned",
    owner: "backend",
    description: "Gobierno multiempresa, branding, estado comercial y configuración de instancia.",
    capabilities: [
      "tenant_bootstrap",
      "tenant_settings",
      "tenant_activation",
      "tenant_branding",
      "tenant_billing_profile",
    ],
  },
  users: {
    id: "users",
    label: "Usuarios",
    priority: 1,
    status: "planned",
    owner: "backend",
    description: "Alta, edición, desactivación, acceso temporal y auditoría de usuarios por tenant.",
    capabilities: [
      "create_user",
      "update_user",
      "reset_access",
      "deactivate_user",
      "user_audit_log",
    ],
  },
  permissions: {
    id: "permissions",
    label: "Roles y permisos",
    priority: 1,
    status: "planned",
    owner: "backend",
    description: "Enforcement server-side de roles base y personalizados por empresa.",
    capabilities: [
      "role_catalog",
      "custom_role_management",
      "permission_resolution",
      "action_authorization",
    ],
  },
  checkout: {
    id: "checkout",
    label: "Checkout self-serve",
    priority: 2,
    status: "in_design",
    owner: "backend",
    description: "Checkout intents, pago, activación guiada y estados comerciales del self-serve.",
    capabilities: [
      "create_checkout_intent",
      "create_fintoc_session",
      "checkout_webhook",
      "activation_state_machine",
    ],
  },
  billing: {
    id: "billing",
    label: "Facturación electrónica",
    priority: 2,
    status: "in_design",
    owner: "backend",
    description: "Emisión manual, adaptador Bsale, sincronización y auditoría documental.",
    capabilities: [
      "manual_document_emission",
      "provider_adapter_bsale",
      "document_status_sync",
      "billing_audit_log",
    ],
  },
  integrations: {
    id: "integrations",
    label: "Integraciones",
    priority: 2,
    status: "in_design",
    owner: "backend",
    description: "Credenciales, webhooks, logs, retries y contratos por proveedor.",
    capabilities: [
      "provider_credentials",
      "webhook_ingestion",
      "integration_logs",
      "retry_queue",
    ],
  },
  treasury: {
    id: "treasury",
    label: "Tesorería",
    priority: 3,
    status: "planned",
    owner: "backend",
    description: "CxC, CxP, cartera, pagos y trazabilidad financiera server-side.",
    capabilities: [
      "receipts_registry",
      "disbursements_registry",
      "cash_position",
      "treasury_audit",
    ],
  },
  payments: {
    id: "payments",
    label: "Payments",
    priority: 3,
    status: "in_design",
    owner: "backend",
    description: "Links de pago por documento, webhooks, estados remotos y conciliación financiera por tenant.",
    capabilities: [
      "invoice_payment_link_create",
      "payment_provider_connection",
      "payment_webhook_ingestion",
      "payment_status_translation",
      "payment_reconciliation",
    ],
  },
  notifications: {
    id: "notifications",
    label: "Notificaciones",
    priority: 3,
    status: "planned",
    owner: "backend",
    description: "Correo transaccional, alertas, plantillas y delivery logs.",
    capabilities: [
      "email_dispatch",
      "notification_templates",
      "delivery_logs",
      "retryable_jobs",
    ],
  },
  calendar: {
    id: "calendar",
    label: "Calendar",
    priority: 3,
    status: "in_design",
    owner: "backend",
    description: "OAuth de Google Calendar, conexión por usuario y sincronización de eventos.",
    capabilities: [
      "google_calendar_oauth_start",
      "google_calendar_oauth_callback",
      "calendar_connection_registry",
      "google_calendar_connection_upsert",
      "google_calendar_connection_delete",
      "google_calendar_connection_list",
      "calendar_event_sync",
    ],
  },
};

export const BACKEND_MIGRATION_PHASES = [
  {
    id: "phase_1_foundation",
    label: "Fase 1 · Foundation",
    domains: ["auth", "tenants", "users", "permissions"],
    goal: "Mover identidad y gobierno multiempresa fuera del frontend.",
  },
  {
    id: "phase_2_revenue",
    label: "Fase 2 · Revenue Engine",
    domains: ["checkout", "billing", "integrations"],
    goal: "Soportar pagos, activación y facturación con backend real.",
  },
  {
    id: "phase_3_finops",
    label: "Fase 3 · FinOps",
    domains: ["treasury", "payments", "notifications", "calendar"],
    goal: "Consolidar automatización financiera, comunicación operacional e integraciones de agenda.",
  },
];

export function getPlatformDomains() {
  return Object.values(PLATFORM_DOMAINS).sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

export function getBackendMigrationPlan() {
  return BACKEND_MIGRATION_PHASES.map(phase => ({
    ...phase,
    domainObjects: phase.domains.map(id => PLATFORM_DOMAINS[id]).filter(Boolean),
  }));
}

export function getBackendDomain(id) {
  return PLATFORM_DOMAINS[id] || null;
}
