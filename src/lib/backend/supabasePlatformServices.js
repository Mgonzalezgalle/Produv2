import { sb } from "../auth/supabaseClient";

const FOUNDATION_BASE_ROLE_KEYS = ["admin", "productor", "comercial", "viewer"];

function createRpcCircuitBreaker() {
  const unavailable = new Set();
  return {
    has: name => unavailable.has(name),
    mark: name => unavailable.add(name),
  };
}

function computePromotionPlansFromSnapshot(snapshot = {}) {
  const customRoleKeys = Array.isArray(snapshot?.customRoles) ? snapshot.customRoles.map(role => role.key) : [];
  const remoteRoles = new Set([...FOUNDATION_BASE_ROLE_KEYS, ...customRoleKeys]);
  const shadows = Array.isArray(snapshot?.userShadows) ? snapshot.userShadows : [];
  const candidates = Array.isArray(snapshot?.identityCandidates) ? snapshot.identityCandidates : [];
  return candidates.map(candidate => {
    const shadow = shadows.find(item => item.id === candidate.id);
    const missingRequirements = [];
    const resolvedEmail = candidate.email || shadow?.email || "";
    if (!resolvedEmail) missingRequirements.push("missing_email");
    if (!(candidate.name || shadow?.name)) missingRequirements.push("missing_name");
    if (!shadow) missingRequirements.push("missing_shadow");
    if (!remoteRoles.has(candidate.role)) missingRequirements.push("unresolved_role");
    const readinessScore =
      (resolvedEmail ? 1 : 0) +
      ((candidate.name || shadow?.name) ? 1 : 0) +
      (shadow ? 1 : 0) +
      (remoteRoles.has(candidate.role) ? 1 : 0);
    return {
      id: candidate.id,
      email: resolvedEmail,
      name: candidate.name || shadow?.name || "",
      role: candidate.role,
      status: missingRequirements.length ? "incomplete" : "ready",
      readinessScore,
      missingRequirements,
      sourceSnapshot: {
        candidateStatus: candidate.status || "pending",
        shadowFound: Boolean(shadow),
        shadowActive: Boolean(shadow?.active),
        isCrew: candidate.isCrew === true,
        crewRole: candidate.crewRole || "",
      },
    };
  });
}

function computeMembershipBlueprintsFromPlans(plans = []) {
  return (Array.isArray(plans) ? plans : []).map(plan => ({
    id: plan.id,
    email: plan.email || "",
    name: plan.name || "",
    role: plan.role || "viewer",
    status: plan.status === "ready" ? "prepared" : "blocked",
    sourcePlanStatus: plan.status || "incomplete",
    metadata: {
      readinessScore: plan.readinessScore ?? 0,
      missingRequirements: Array.isArray(plan.missingRequirements) ? plan.missingRequirements : [],
      sourceSnapshot: plan.sourceSnapshot || {},
    },
  }));
}

function computeMembershipTransitionQueueFromBlueprints(blueprints = []) {
  return (Array.isArray(blueprints) ? blueprints : []).map(blueprint => ({
    id: blueprint.id,
    email: blueprint.email || "",
    name: blueprint.name || "",
    role: blueprint.role || "viewer",
    status: blueprint.status === "prepared" ? "pending_profile" : "blocked",
    sourceBlueprintStatus: blueprint.status || "blocked",
    metadata: {
      blueprint: blueprint.metadata || {},
      nextStep: blueprint.status === "prepared" ? "create_profile_and_membership" : "resolve_blockers",
    },
  }));
}

async function callRoleRpc(fn, params = {}) {
  const { data, error } = await sb.rpc(fn, params);
  if (error) {
    throw new Error(error.message || `RPC ${fn} falló.`);
  }
  return Array.isArray(data) ? data : [];
}

async function callSingleRpc(fn, params = {}) {
  const { data, error } = await sb.rpc(fn, params);
  if (error) {
    throw new Error(error.message || `RPC ${fn} falló.`);
  }
  return data;
}

export function createSupabasePlatformServices({ fallbackServices = null } = {}) {
  const foundationRpcBreaker = createRpcCircuitBreaker();
  const recordEmailLog = async (draft = {}) => {
    if (!fallbackServices?.recordTransactionalEmailLog) return null;
    try {
      return await fallbackServices.recordTransactionalEmailLog(draft);
    } catch {
      return null;
    }
  };

  return {
    ...(fallbackServices || {}),

    async appendSyncAuditLog(tenantId, action, entityType, entityId = "", payload = {}) {
      if (foundationRpcBreaker.has("append_legacy_sync_audit_log")) {
        if (fallbackServices?.appendSyncAuditLog) {
          const fallbackResult = await fallbackServices.appendSyncAuditLog(tenantId, action, entityType, entityId, payload);
          return { ok: true, source: "fallback", auditLog: fallbackResult || null };
        }
        return { ok: false, source: "degraded", auditLog: null };
      }
      try {
        const auditLog = await callSingleRpc("append_legacy_sync_audit_log", {
          legacy_emp_id: tenantId,
          action_name: action,
          entity_type_name: entityType,
          entity_identifier: entityId,
          payload_data: payload,
        });
        return { ok: true, source: "remote", auditLog };
      } catch (error) {
        foundationRpcBreaker.mark("append_legacy_sync_audit_log");
        if (fallbackServices?.appendSyncAuditLog) {
          const fallbackResult = await fallbackServices.appendSyncAuditLog(tenantId, action, entityType, entityId, payload);
          return { ok: true, source: "fallback", auditLog: fallbackResult || null };
        }
        return { ok: false, source: "degraded", auditLog: null };
      }
    },

    async syncLegacyTenant({ legacyEmpId = "", empresa = {} } = {}) {
      if (foundationRpcBreaker.has("sync_legacy_tenant_snapshot")) {
        if (fallbackServices?.syncLegacyTenant) {
          const fallbackTenant = await fallbackServices.syncLegacyTenant({ legacyEmpId, empresa });
          return { ok: true, source: "fallback", tenant: fallbackTenant?.tenant || fallbackTenant || null };
        }
        return { ok: false, source: "degraded", tenant: null };
      }
      try {
        const tenant = await callSingleRpc("sync_legacy_tenant_snapshot", {
          legacy_emp_id: legacyEmpId,
          tenant_snapshot: empresa || {},
        });
        return { ok: true, source: "remote", tenant };
      } catch (error) {
        foundationRpcBreaker.mark("sync_legacy_tenant_snapshot");
        if (fallbackServices?.syncLegacyTenant) {
          const fallbackTenant = await fallbackServices.syncLegacyTenant({ legacyEmpId, empresa });
          return { ok: true, source: "fallback", tenant: fallbackTenant?.tenant || fallbackTenant || null };
        }
        return { ok: false, source: "degraded", tenant: null, error: error.message || "No pudimos sincronizar el tenant." };
      }
    },

    async syncTenantUserShadows(tenantId, tenantUsers = []) {
      if (foundationRpcBreaker.has("replace_legacy_tenant_user_shadows")) {
        return fallbackServices?.syncTenantUserShadows ? fallbackServices.syncTenantUserShadows(tenantId, tenantUsers) : [];
      }
      const { data, error } = await sb.rpc("replace_legacy_tenant_user_shadows", {
        legacy_emp_id: tenantId,
        user_shadows: Array.isArray(tenantUsers) ? tenantUsers : [],
      });
      if (error) {
        foundationRpcBreaker.mark("replace_legacy_tenant_user_shadows");
        if (fallbackServices?.syncTenantUserShadows) return fallbackServices.syncTenantUserShadows(tenantId, tenantUsers);
        throw new Error(error.message || "No pudimos sincronizar usuarios shadow.");
      }
      await this.appendSyncAuditLog(tenantId, "tenant_users_shadow_synced", "legacy_user_shadows", tenantId, {
        count: Array.isArray(data) ? data.length : 0,
      });
      return Array.isArray(data) ? data : [];
    },

    async syncIdentityCandidates(tenantId, candidates = []) {
      if (foundationRpcBreaker.has("replace_legacy_identity_candidates")) {
        return fallbackServices?.syncIdentityCandidates ? fallbackServices.syncIdentityCandidates(tenantId, candidates) : [];
      }
      const { data, error } = await sb.rpc("replace_legacy_identity_candidates", {
        legacy_emp_id: tenantId,
        candidates: Array.isArray(candidates) ? candidates : [],
      });
      if (error) {
        foundationRpcBreaker.mark("replace_legacy_identity_candidates");
        if (fallbackServices?.syncIdentityCandidates) return fallbackServices.syncIdentityCandidates(tenantId, candidates);
        throw new Error(error.message || "No pudimos sincronizar identity candidates.");
      }
      await this.appendSyncAuditLog(tenantId, "identity_candidates_synced", "identity_candidates", tenantId, {
        count: Array.isArray(data) ? data.length : 0,
      });
      return Array.isArray(data) ? data : [];
    },

    async planIdentityPromotions(tenantId) {
      const { data, error } = await sb.rpc("plan_legacy_identity_promotions", {
        legacy_emp_id: tenantId,
      });
      if (error) {
        const snapshot = await this.getTenantPlatformSnapshot(tenantId);
        return computePromotionPlansFromSnapshot(snapshot);
      }
      await this.appendSyncAuditLog(tenantId, "identity_promotion_planned", "identity_promotion_plans", tenantId, {
        count: Array.isArray(data) ? data.length : 0,
      });
      return Array.isArray(data) ? data : [];
    },

    async prepareIdentityMembershipBlueprints(tenantId) {
      const { data, error } = await sb.rpc("prepare_identity_membership_blueprints", {
        legacy_emp_id: tenantId,
      });
      if (error) {
        const snapshot = await this.getTenantPlatformSnapshot(tenantId);
        return computeMembershipBlueprintsFromPlans(snapshot?.promotionPlans || []);
      }
      await this.appendSyncAuditLog(tenantId, "identity_membership_blueprints_prepared", "identity_membership_blueprints", tenantId, {
        count: Array.isArray(data) ? data.length : 0,
      });
      return Array.isArray(data) ? data : [];
    },

    async prepareMembershipTransitionQueue(tenantId) {
      const { data, error } = await sb.rpc("prepare_membership_transition_queue", {
        legacy_emp_id: tenantId,
      });
      if (error) {
        const snapshot = await this.getTenantPlatformSnapshot(tenantId);
        return computeMembershipTransitionQueueFromBlueprints(snapshot?.membershipBlueprints || []);
      }
      await this.appendSyncAuditLog(tenantId, "membership_transition_queue_prepared", "membership_transition_queue", tenantId, {
        count: Array.isArray(data) ? data.length : 0,
      });
      return Array.isArray(data) ? data : [];
    },

    async getTenantPlatformSnapshot(tenantId) {
      if (foundationRpcBreaker.has("get_legacy_tenant_platform_snapshot")) {
        return fallbackServices?.getTenantPlatformSnapshot ? fallbackServices.getTenantPlatformSnapshot(tenantId) : {};
      }
      try {
        return await callSingleRpc("get_legacy_tenant_platform_snapshot", {
          legacy_emp_id: tenantId,
        });
      } catch (error) {
        foundationRpcBreaker.mark("get_legacy_tenant_platform_snapshot");
        if (fallbackServices?.getTenantPlatformSnapshot) return fallbackServices.getTenantPlatformSnapshot(tenantId);
        throw error;
      }
    },

    async upsertBsaleSyncSession(tenantId, session = {}) {
      if (foundationRpcBreaker.has("upsert_bsale_sync_session")) {
        return fallbackServices?.upsertBsaleSyncSession ? fallbackServices.upsertBsaleSyncSession(tenantId, session) : null;
      }
      const { data, error } = await sb.rpc("upsert_bsale_sync_session", {
        legacy_emp_id: tenantId,
        source_document_id: session.sourceDocumentId || session.facturaId || "",
        session_key: session.sessionKey || session.id || "",
        status_name: session.status || "draft",
        external_document_id: session.externalDocumentId || "",
        external_folio: session.externalFolio ? String(session.externalFolio) : "",
        provider_status_name: session.providerStatus || "",
        request_payload_data: session.request || {},
        response_payload_data: session.response || {},
        metadata_data: session.metadata || {},
      });
      if (error) {
        foundationRpcBreaker.mark("upsert_bsale_sync_session");
        if (fallbackServices?.upsertBsaleSyncSession) return fallbackServices.upsertBsaleSyncSession(tenantId, session);
        throw new Error(error.message || "No pudimos persistir la sesión Bsale.");
      }
      await this.appendSyncAuditLog(tenantId, "bsale_sync_session_upserted", "bsale_sync_session", session.sessionKey || session.id || "", {
        sourceDocumentId: session.sourceDocumentId || session.facturaId || "",
        status: session.status || "draft",
      });
      return data;
    },

    async listBsaleSyncSessions(tenantId, sourceDocumentId = "") {
      if (foundationRpcBreaker.has("get_bsale_sync_sessions")) {
        return fallbackServices?.listBsaleSyncSessions ? fallbackServices.listBsaleSyncSessions(tenantId, sourceDocumentId) : [];
      }
      const { data, error } = await sb.rpc("get_bsale_sync_sessions", {
        legacy_emp_id: tenantId,
        source_document_id: sourceDocumentId || "",
      });
      if (error) {
        foundationRpcBreaker.mark("get_bsale_sync_sessions");
        if (fallbackServices?.listBsaleSyncSessions) return fallbackServices.listBsaleSyncSessions(tenantId, sourceDocumentId);
        throw new Error(error.message || "No pudimos listar las sesiones Bsale.");
      }
      return Array.isArray(data) ? data : [];
    },

    async listTenantRoles(tenantId) {
      return callRoleRpc("get_legacy_tenant_custom_roles", {
        legacy_emp_id: tenantId,
      });
    },

    async createTenantRole(tenantId, roleDraft = {}) {
      const roles = await callRoleRpc("upsert_legacy_tenant_role", {
        legacy_emp_id: tenantId,
        p_role_key: roleDraft.key || "",
        p_role_label: roleDraft.label || "Nuevo rol",
        p_role_color: roleDraft.color || "#7c7c8a",
        p_role_badge: roleDraft.badge || "gray",
        p_permission_keys: Array.isArray(roleDraft.permissions) ? roleDraft.permissions : [],
      });
      await this.appendSyncAuditLog(tenantId, "tenant_role_upserted", "role", roleDraft.key || "", {
        label: roleDraft.label || "Nuevo rol",
        permissions: Array.isArray(roleDraft.permissions) ? roleDraft.permissions : [],
      });
      return roles;
    },

    async updateTenantRole(tenantId, roleKey, patch = {}) {
      const roles = await callRoleRpc("upsert_legacy_tenant_role", {
        legacy_emp_id: tenantId,
        p_role_key: roleKey || "",
        p_role_label: patch.label || "Rol",
        p_role_color: patch.color || "#7c7c8a",
        p_role_badge: patch.badge || "gray",
        p_permission_keys: Array.isArray(patch.permissions) ? patch.permissions : [],
      });
      await this.appendSyncAuditLog(tenantId, "tenant_role_upserted", "role", roleKey || "", {
        label: patch.label || "Rol",
        permissions: Array.isArray(patch.permissions) ? patch.permissions : [],
      });
      return roles;
    },

    async deleteTenantRole(tenantId, roleKey) {
      const roles = await callRoleRpc("delete_legacy_tenant_role", {
        legacy_emp_id: tenantId,
        p_role_key: roleKey || "",
      });
      await this.appendSyncAuditLog(tenantId, "tenant_role_deleted", "role", roleKey || "", {});
      return roles;
    },

    async sendTransactionalEmail(payload = {}) {
      const { data, error } = await sb.functions.invoke("send-transactional-email", {
        body: payload || {},
      });
      if (error) {
        await recordEmailLog({
          tenantId: payload.tenantId || payload.empId || "",
          templateKey: payload.templateKey || "",
          provider: "resend",
          source: "degraded",
          status: "error",
          subject: payload.subject || "",
          to: Array.isArray(payload.to) ? payload.to : [],
          entityType: payload.entityType || "",
          entityId: payload.entityId || "",
          metadata: payload.metadata || {},
          message: error.message || "No pudimos enviar el correo transaccional.",
        });
        if (fallbackServices?.sendTransactionalEmail) return fallbackServices.sendTransactionalEmail(payload);
        return {
          ok: false,
          source: "degraded",
          provider: "resend",
          message: error.message || "No pudimos enviar el correo transaccional.",
        };
      }
      const remoteDelivery = data?.delivery || {};
      await recordEmailLog({
        id: remoteDelivery?.id || "",
        tenantId: payload.tenantId || payload.empId || "",
        templateKey: payload.templateKey || "",
        provider: data?.provider || "resend",
        source: data?.source || "remote",
        status: data?.status || (data?.ok ? "accepted" : "unknown"),
        subject: payload.subject || "",
        to: Array.isArray(payload.to) ? payload.to : [],
        entityType: payload.entityType || "",
        entityId: payload.entityId || "",
        metadata: {
          ...(payload.metadata || {}),
          remoteDeliveryId: remoteDelivery?.id || "",
        },
        providerPayload: payload || {},
        message: data?.message || "",
      });
      return data || {
        ok: false,
        source: "degraded",
        provider: "resend",
        message: "La función de correo no devolvió respuesta.",
      };
    },

    async listTransactionalEmailLogs({ tenantId = "" } = {}) {
      if (fallbackServices?.listTransactionalEmailLogs) return fallbackServices.listTransactionalEmailLogs({ tenantId });
      return [];
    },

    async saveUserGoogleCalendarConnection(userId, connection = {}) {
      if (fallbackServices?.saveUserGoogleCalendarConnection) {
        return fallbackServices.saveUserGoogleCalendarConnection(userId, connection);
      }
      return null;
    },

    async clearUserGoogleCalendarConnection(userId) {
      if (fallbackServices?.clearUserGoogleCalendarConnection) {
        return fallbackServices.clearUserGoogleCalendarConnection(userId);
      }
      return null;
    },

    async listTenantCalendarConnections(tenantId = "") {
      if (fallbackServices?.listTenantCalendarConnections) {
        return fallbackServices.listTenantCalendarConnections(tenantId);
      }
      return [];
    },
  };
}
