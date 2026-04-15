import { sb } from "../auth/supabaseClient";

function buildUnavailable(message = "Esta capacidad todavía no está abierta en Supabase foundation.", source = "degraded") {
  return { ok: false, message, error: message, source };
}

async function callFoundationRpc(fn, params = {}) {
  const { data, error } = await sb.rpc(fn, params);
  if (error) {
    return {
      ok: false,
      error: error.message || `RPC ${fn} falló.`,
      data: null,
    };
  }
  return {
    ok: true,
    data,
  };
}

async function callEdgeFunction(name, payload = {}) {
  const { data, error } = await sb.functions.invoke(name, {
    body: payload,
  });
  if (error) {
    return {
      ok: false,
      error: error.message || `Function ${name} falló.`,
      data: null,
    };
  }
  return {
    ok: true,
    data,
  };
}

export function createSupabasePlatformApiAdapter({
  authGateway = null,
  users = [],
  empresas = [],
}) {
  const unavailableFoundationRpcs = new Set();

  return {
    auth: {
      async loginWithPassword({ email, password }) {
        return authGateway.authenticate({ users, empresas, email, password });
      },

      async restoreSession({ storedSession = null } = {}) {
        return authGateway.restoreSession({ storedSession, users, empresas });
      },

      async logout() {
        await authGateway.clearSession({ sessionKey: "" });
        return { ok: true };
      },

      async requestPasswordReset({ email }) {
        return authGateway.requestPasswordReset({ email });
      },
    },

    tenants: {
      async createPendingTenant(payload = {}) {
        const rpc = await callFoundationRpc("request_tenant_bootstrap", {
          company_draft: payload.companyDraft || {},
          requested_modules: payload.requestedModules || [],
          customer_type: payload.customerType || "productora",
          team_size: payload.teamSize || "1-3",
        });
        if (!rpc.ok) return rpc;
        return { tenantDraft: rpc.data };
      },

      async syncLegacyTenant({ legacyEmpId = "", empresa = {} } = {}) {
        if (unavailableFoundationRpcs.has("sync_legacy_tenant_snapshot")) {
          return buildUnavailable("La sincronización foundation del tenant quedó temporalmente degradada en esta sesión.");
        }
        const rpc = await callFoundationRpc("sync_legacy_tenant_snapshot", {
          legacy_emp_id: legacyEmpId,
          tenant_snapshot: empresa || {},
        });
        if (!rpc.ok) unavailableFoundationRpcs.add("sync_legacy_tenant_snapshot");
        if (!rpc.ok) return rpc;
        return { ok: true, source: "remote", tenant: rpc.data };
      },

      async activatePendingTenant() {
        return buildUnavailable("La activación real del tenant en Supabase se abrirá después del primer RPC de bootstrap.");
      },
    },

    checkout: {
      async confirmPayment() {
        return buildUnavailable("La confirmación real de pago seguirá detrás de Fintoc server-side.");
      },
    },

    billing: {
      async getDocumentStatus({ documentId = "" } = {}) {
        const rpc = await callFoundationRpc("get_bsale_sync_status", {
          document_id: documentId,
        });
        if (!rpc.ok) return rpc;
        return rpc.data || buildUnavailable("No existe sincronización Bsale para este documento.");
      },
    },

    foundation: {
      async status() {
        return callFoundationRpc("platform_foundation_status");
      },
      async appendSyncAuditLog({
        legacyEmpId = "",
        action = "",
        entityType = "",
        entityId = "",
        payload = {},
      } = {}) {
        if (unavailableFoundationRpcs.has("append_legacy_sync_audit_log")) {
          return buildUnavailable("El audit log foundation quedó temporalmente degradado en esta sesión.");
        }
        const rpc = await callFoundationRpc("append_legacy_sync_audit_log", {
          legacy_emp_id: legacyEmpId,
          action_name: action,
          entity_type_name: entityType,
          entity_identifier: entityId,
          payload_data: payload || {},
        });
        if (!rpc.ok) unavailableFoundationRpcs.add("append_legacy_sync_audit_log");
        if (!rpc.ok) return rpc;
        return { ok: true, source: "remote", auditLog: rpc.data };
      },
    },

    notifications: {
      async sendTransactionalEmail(payload = {}) {
        const fn = await callEdgeFunction("send-transactional-email", payload);
        if (!fn.ok) {
          return buildUnavailable(fn.error || "No pudimos enviar el correo transaccional desde la función remota.");
        }
        return fn.data || { ok: false, source: "degraded", message: "La función remota no devolvió respuesta." };
      },

      async listTransactionalEmailLogs() {
        return buildUnavailable("Los logs de correo transaccional todavía no están expuestos desde Supabase foundation.");
      },
    },

    calendar: {
      async startGoogleCalendarOAuth(payload = {}) {
        const fn = await callEdgeFunction("google-calendar-oauth-start", payload);
        if (!fn.ok) {
          return buildUnavailable(fn.error || "No pudimos iniciar OAuth de Google Calendar.");
        }
        return fn.data || { ok: false, source: "degraded", message: "La función de Google Calendar no devolvió respuesta." };
      },

      async completeGoogleCalendarOAuth(payload = {}) {
        const fn = await callEdgeFunction("google-calendar-oauth-callback", payload);
        if (!fn.ok) {
          return buildUnavailable(fn.error || "No pudimos completar OAuth de Google Calendar.");
        }
        return fn.data || { ok: false, source: "degraded", message: "La función callback de Google Calendar no devolvió respuesta." };
      },

      async createGoogleCalendarEvent(payload = {}) {
        const fn = await callEdgeFunction("google-calendar-create-event", payload);
        if (!fn.ok) {
          return buildUnavailable(fn.error || "No pudimos crear el evento en Google Calendar.");
        }
        return fn.data || { ok: false, source: "degraded", message: "La función de creación de eventos no devolvió respuesta." };
      },

      async listGoogleCalendarEvents(payload = {}) {
        const fn = await callEdgeFunction("google-calendar-list-events", payload);
        if (!fn.ok) {
          return buildUnavailable(fn.error || "No pudimos leer los eventos de Google Calendar.");
        }
        return fn.data || { ok: false, source: "degraded", message: "La función de lectura de eventos no devolvió respuesta." };
      },

      async deleteGoogleCalendarEvent(payload = {}) {
        const fn = await callEdgeFunction("google-calendar-delete-event", payload);
        if (!fn.ok) {
          return buildUnavailable(fn.error || "No pudimos eliminar el evento en Google Calendar.");
        }
        return fn.data || { ok: false, source: "degraded", message: "La función de eliminación no devolvió respuesta." };
      },
    },
  };
}
