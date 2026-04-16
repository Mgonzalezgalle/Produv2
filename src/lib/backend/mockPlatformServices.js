import { normalizeUsersAuth } from "../auth/authCrypto";
import { getCustomRoles } from "../auth/authorization";
import { normalizeEmpresasModel, uid } from "../utils/helpers";
import { loadBsaleEmissionSessions, saveBsaleEmissionSessions } from "../lab/bsaleMockApi";
import { buildResendEmailRequest } from "../integrations/resendTransactionalEmail";
import { getTransactionalEmailProviderSnapshot } from "../integrations/transactionalEmailConfig";
import { getGoogleCalendarConfig, getGoogleCalendarProviderSnapshot } from "../integrations/googleCalendarConfig";
import { buildMercadoPagoPreferenceRequest } from "../integrations/mercadoPagoPaymentsProvider";

export function createMockPlatformServices({ dbGet, dbSet, sha256Hex }) {
  const loadEmpresas = async () => normalizeEmpresasModel((await dbGet("produ:empresas")) || []);
  const saveEmpresas = async next => {
    const normalized = normalizeEmpresasModel(next);
    await dbSet("produ:empresas", normalized);
    return normalized;
  };

  const loadUsers = async () => normalizeUsersAuth((await dbGet("produ:users")) || []);
  const saveUsers = async next => {
    const normalized = await normalizeUsersAuth(next);
    await dbSet("produ:users", normalized);
    return normalized;
  };
  const loadEmailDeliveryLogs = async () => (await dbGet("produ:emailDeliveryLogs")) || [];
  const saveEmailDeliveryLogs = async next => {
    await dbSet("produ:emailDeliveryLogs", Array.isArray(next) ? next : []);
    return Array.isArray(next) ? next : [];
  };
  const recordEmailDeliveryLog = async (draft = {}) => {
    const logs = await loadEmailDeliveryLogs();
    const delivery = {
      id: draft.id || uid(),
      tenantId: String(draft.tenantId || draft.empId || "").trim(),
      templateKey: String(draft.templateKey || "").trim(),
      provider: String(draft.provider || "resend").trim(),
      source: String(draft.source || "mock").trim(),
      status: String(draft.status || "accepted").trim(),
      subject: String(draft.subject || "").trim(),
      to: Array.isArray(draft.to) ? draft.to : [],
      entityType: String(draft.entityType || "").trim(),
      entityId: String(draft.entityId || "").trim(),
      metadata: draft.metadata && typeof draft.metadata === "object" ? draft.metadata : {},
      providerPayload: draft.providerPayload && typeof draft.providerPayload === "object" ? draft.providerPayload : {},
      message: String(draft.message || "").trim(),
      createdAt: draft.createdAt || new Date().toISOString(),
    };
    await saveEmailDeliveryLogs([delivery, ...(Array.isArray(logs) ? logs : [])]);
    return delivery;
  };
  const loadMercadoPagoLogs = async () => (await dbGet("produ:mercadoPagoLogs")) || [];
  const saveMercadoPagoLogs = async next => {
    await dbSet("produ:mercadoPagoLogs", Array.isArray(next) ? next : []);
    return Array.isArray(next) ? next : [];
  };
  const recordMercadoPagoLog = async (draft = {}) => {
    const logs = await loadMercadoPagoLogs();
    const entry = {
      id: draft.id || uid(),
      tenantId: String(draft.tenantId || "").trim(),
      invoiceId: String(draft.invoiceId || "").trim(),
      provider: "mercadopago",
      action: String(draft.action || "unknown").trim(),
      status: String(draft.status || "draft").trim(),
      paymentId: String(draft.paymentId || "").trim(),
      preferenceId: String(draft.preferenceId || "").trim(),
      externalReference: String(draft.externalReference || "").trim(),
      amount: Number(draft.amount || 0),
      currency: String(draft.currency || "CLP").trim(),
      metadata: draft.metadata && typeof draft.metadata === "object" ? draft.metadata : {},
      createdAt: draft.createdAt || new Date().toISOString(),
    };
    await saveMercadoPagoLogs([entry, ...(Array.isArray(logs) ? logs : [])]);
    return entry;
  };
  const buildTenantSnapshot = async tenantId => {
    const tenant = await loadEmpresas().then(empresas => empresas.find(emp => emp.id === tenantId) || null);
    if (!tenant) return null;
    const tenantUsers = await loadUsers().then(users => users.filter(user => user.empId === tenantId));
    const bsale = tenant?.integrationConfigs?.bsale || {};
    const bsaleSandbox = bsale?.sandbox || {};
    return {
      tenant: {
        id: tenant.id,
        tenant_code: tenant.tenantCode || "",
        status: tenant.active !== false ? "active" : "inactive",
        active: tenant.active !== false,
        billing_status: tenant.billingStatus || "Pendiente",
        billing_currency: tenant.billingCurrency || "UF",
        billing_monthly: Number(tenant.billingMonthly || 0),
        requested_modules: Array.isArray(tenant.addons) ? tenant.addons : [],
      },
      modules: {
        provisioned: Array.isArray(tenant.addons) ? tenant.addons : [],
      },
      integrations: {
        bsale: {
          governanceMode: bsale?.governance?.mode || "disabled",
          status: bsaleSandbox.status || "draft",
          officeId: bsaleSandbox.officeId || "",
          documentTypeId: bsaleSandbox.documentTypeId || "",
          priceListId: bsaleSandbox.priceListId || "",
          tokenConfigured: Boolean(bsaleSandbox.token || bsaleSandbox.tokenConfigured),
        },
      },
      customRoles: getCustomRoles(tenant),
      userShadows: tenantUsers,
      identityCandidates: [],
      promotionPlans: [],
      membershipBlueprints: [],
      membershipTransitionQueue: [],
      auditLogs: [],
    };
  };

  return {
    async syncLegacyTenant({ legacyEmpId = "", empresa = {} } = {}) {
      return {
        ok: true,
        source: "fallback",
        tenant: {
          id: legacyEmpId,
          tenant_code: empresa?.tenantCode || "",
          status: empresa?.active !== false ? "active" : "inactive",
          active: empresa?.active !== false,
          billing_status: empresa?.billingStatus || "Pendiente",
          billing_currency: empresa?.billingCurrency || "UF",
          billing_monthly: Number(empresa?.billingMonthly || 0),
        },
      };
    },

    async appendSyncAuditLog(tenantId, action, entityType, entityId = "", payload = {}) {
      return {
        id: uid(),
        tenantId,
        action,
        entityType,
        entityId,
        payload,
        createdAt: new Date().toISOString(),
        source: "fallback",
      };
    },

    async getTenantPlatformSnapshot(tenantId) {
      return (await buildTenantSnapshot(tenantId)) || {};
    },

    async getTenant(tenantId) {
      const empresas = await loadEmpresas();
      return empresas.find(emp => emp.id === tenantId) || null;
    },

    async updateTenant(tenantId, patch = {}) {
      const empresas = await loadEmpresas();
      const next = empresas.map(emp => emp.id === tenantId ? { ...emp, ...patch } : emp);
      await saveEmpresas(next);
      return next.find(emp => emp.id === tenantId) || null;
    },

    async listTenantUsers(tenantId) {
      const users = await loadUsers();
      return users.filter(user => user.empId === tenantId);
    },

    async createTenantUser({
      tenantId,
      name,
      email,
      role = "viewer",
      active = true,
      password = "",
      isCrew = false,
      crewRole = "",
    }) {
      const users = await loadUsers();
      const nextUser = {
        id: uid(),
        name: String(name || "").trim(),
        email: String(email || "").trim(),
        role,
        empId: tenantId,
        active: active !== false,
        isCrew: isCrew === true,
        crewRole: isCrew === true ? (crewRole || "Crew interno") : "",
        passwordHash: password ? await sha256Hex(password) : "",
      };
      await saveUsers([...(users || []), nextUser]);
      return nextUser;
    },

    async updateTenantUser(userId, patch = {}) {
      const users = await loadUsers();
      const target = users.find(user => user.id === userId);
      if (!target) return null;
      const nextUser = {
        ...target,
        ...patch,
      };
      if (Object.prototype.hasOwnProperty.call(patch, "password")) {
        nextUser.passwordHash = patch.password ? await sha256Hex(patch.password) : (target.passwordHash || "");
        delete nextUser.password;
      }
      await saveUsers(users.map(user => user.id === userId ? nextUser : user));
      return nextUser;
    },

    async deleteTenantUser(userId) {
      const users = await loadUsers();
      const target = users.find(user => user.id === userId);
      if (!target) return { ok: false };
      await saveUsers(users.filter(user => user.id !== userId));
      return { ok: true };
    },

    async listTenantRoles(tenantId) {
      const tenant = await this.getTenant(tenantId);
      return getCustomRoles(tenant);
    },

    async createTenantRole(tenantId, roleDraft = {}) {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) return null;
      const customRoles = getCustomRoles(tenant);
      const nextRole = {
        key: roleDraft.key || `custom_${uid().slice(1, 7)}`,
        label: String(roleDraft.label || "Nuevo rol").trim(),
        color: roleDraft.color || "#7c7c8a",
        badge: roleDraft.badge || "gray",
        permissions: Array.isArray(roleDraft.permissions) ? roleDraft.permissions : [],
      };
      await this.updateTenant(tenantId, { customRoles: [...customRoles, nextRole] });
      return nextRole;
    },

    async updateTenantRole(tenantId, roleKey, patch = {}) {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) return null;
      const customRoles = getCustomRoles(tenant);
      const nextRoles = customRoles.map(role => role.key === roleKey ? { ...role, ...patch } : role);
      await this.updateTenant(tenantId, { customRoles: nextRoles });
      return nextRoles.find(role => role.key === roleKey) || null;
    },

    async deleteTenantRole(tenantId, roleKey) {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) return { ok: false, reason: "tenant_not_found" };
      const users = await this.listTenantUsers(tenantId);
      const assigned = users.filter(user => user.role === roleKey);
      if (assigned.length) return { ok: false, reason: "role_in_use", assignedCount: assigned.length };
      const customRoles = getCustomRoles(tenant);
      await this.updateTenant(tenantId, { customRoles: customRoles.filter(role => role.key !== roleKey) });
      return { ok: true };
    },

    async upsertBsaleSyncSession(tenantId, session = {}) {
      const sessions = await loadBsaleEmissionSessions(dbGet);
      const nextRecord = {
        id: session.id || session.sessionKey || uid(),
        provider: "bsale",
        mode: session.mode || "manual",
        status: session.status || "draft",
        facturaId: session.sourceDocumentId || session.facturaId || "",
        empId: tenantId,
        request: session.request || {},
        response: session.response || {},
        metadata: session.metadata || {},
        externalDocumentId: session.externalDocumentId || "",
        externalFolio: session.externalFolio || "",
        providerStatus: session.providerStatus || "",
        createdAt: session.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextSessions = [
        ...sessions.filter(item => item.id !== nextRecord.id),
        nextRecord,
      ];
      await saveBsaleEmissionSessions(dbSet, nextSessions);
      return nextRecord;
    },

    async listBsaleSyncSessions(tenantId, sourceDocumentId = "") {
      const sessions = await loadBsaleEmissionSessions(dbGet);
      return sessions.filter(item =>
        item.empId === tenantId &&
        (!sourceDocumentId || item.facturaId === sourceDocumentId)
      );
    },

    async sendTransactionalEmail(payload = {}) {
      const providerSnapshot = getTransactionalEmailProviderSnapshot();
      const resendRequest = buildResendEmailRequest(payload);
      if (!providerSnapshot.enabled) {
        return {
          ok: false,
          source: "mock",
          provider: providerSnapshot.provider,
          status: "disabled",
          message: "El correo transaccional no está habilitado.",
          config: providerSnapshot,
        };
      }
      if (!resendRequest.ok) {
        return {
          ok: false,
          source: "mock",
          provider: providerSnapshot.provider,
          status: "invalid",
          errors: resendRequest.errors || [],
          config: providerSnapshot,
        };
      }
      const delivery = await recordEmailDeliveryLog({
        tenantId: String(payload.tenantId || payload.empId || "").trim(),
        templateKey: resendRequest.draft.templateKey,
        provider: providerSnapshot.provider,
        source: "mock",
        status: providerSnapshot.ready ? "accepted" : "draft",
        subject: resendRequest.draft.subject,
        to: resendRequest.draft.to,
        entityType: resendRequest.draft.entityType,
        entityId: resendRequest.draft.entityId,
        metadata: resendRequest.draft.metadata || {},
        providerPayload: resendRequest.request,
      });
      return {
        ok: true,
        source: "mock",
        provider: providerSnapshot.provider,
        status: delivery.status,
        config: providerSnapshot,
        delivery,
      };
    },

    async listTransactionalEmailLogs({ tenantId = "" } = {}) {
      const logs = await loadEmailDeliveryLogs();
      return (Array.isArray(logs) ? logs : []).filter(item => !tenantId || item.tenantId === tenantId);
    },

    async createMercadoPagoPaymentLink(payload = {}) {
      const request = buildMercadoPagoPreferenceRequest(payload);
      if (!request?.ok) {
        return {
          ok: false,
          source: "mock",
          provider: "mercadopago",
          status: "invalid",
          message: request?.error || "No pudimos preparar el link de pago.",
          validation: request?.validation || null,
        };
      }
      const suffix = Math.random().toString(36).slice(2, 10);
      const paymentLink = {
        provider: "mercadopago",
        mode: "mock",
        status: "active",
        preferenceId: `mp_pref_${payload?.invoiceId || suffix}_${suffix}`,
        externalReference: request.externalReference,
        initPoint: `https://www.mercadopago.cl/checkout/v1/redirect?pref_id=mp_pref_${payload?.invoiceId || suffix}_${suffix}`,
        amount: Number(payload?.amount || 0),
        currency: String(payload?.currency || "CLP").trim(),
        customerName: String(payload?.customer?.name || "").trim(),
        createdAt: new Date().toISOString(),
        expiresAt: payload?.payload?.expiration_date_to || "",
      };
      const delivery = await recordMercadoPagoLog({
        tenantId: payload?.tenantId || "",
        invoiceId: payload?.invoiceId || "",
        action: "payment_link_created",
        status: "active",
        preferenceId: paymentLink.preferenceId,
        externalReference: paymentLink.externalReference,
        amount: paymentLink.amount,
        currency: paymentLink.currency,
        metadata: payload?.metadata || {},
      });
      return {
        ok: true,
        source: "mock",
        provider: "mercadopago",
        status: "active",
        paymentLink,
        delivery,
      };
    },

    async handleMercadoPagoPayment(payload = {}) {
      const normalizedStatus = String(payload?.status || "pending").trim().toLowerCase();
      const approved = normalizedStatus === "approved";
      const rejected = normalizedStatus === "rejected";
      const pending = !approved && !rejected;
      const paymentResult = {
        provider: "mercadopago",
        paymentId: String(payload?.paymentId || `mp_pay_${Date.now()}`).trim(),
        preferenceId: String(payload?.preferenceId || "").trim(),
        externalReference: String(payload?.externalReference || "").trim(),
        status: approved ? "approved" : rejected ? "rejected" : "pending",
        amount: Number(payload?.amount || 0),
        currency: String(payload?.currency || "CLP").trim(),
        invoiceId: String(payload?.invoiceId || "").trim(),
        tenantId: String(payload?.tenantId || "").trim(),
        approved,
        rejected,
        pending,
        paidAt: approved ? new Date().toISOString() : "",
      };
      const delivery = await recordMercadoPagoLog({
        tenantId: paymentResult.tenantId,
        invoiceId: paymentResult.invoiceId,
        action: "payment_webhook_processed",
        status: paymentResult.status,
        paymentId: paymentResult.paymentId,
        preferenceId: paymentResult.preferenceId,
        externalReference: paymentResult.externalReference,
        amount: paymentResult.amount,
        currency: paymentResult.currency,
        metadata: payload?.metadata || {},
      });
      return {
        ok: true,
        source: "mock",
        provider: "mercadopago",
        paymentResult,
        delivery,
      };
    },

    async listMercadoPagoLogs({ tenantId = "", invoiceId = "" } = {}) {
      const logs = await loadMercadoPagoLogs();
      return (Array.isArray(logs) ? logs : []).filter(item => (!tenantId || item.tenantId === tenantId) && (!invoiceId || item.invoiceId === invoiceId));
    },

    async recordTransactionalEmailLog(draft = {}) {
      return recordEmailDeliveryLog(draft);
    },

    async startGoogleCalendarOAuth(payload = {}) {
      const config = getGoogleCalendarConfig();
      const snapshot = getGoogleCalendarProviderSnapshot();
      if (!snapshot.ready) {
        return {
          ok: false,
          source: "mock",
          provider: "google",
          message: "Google Calendar no está configurado para OAuth en este entorno.",
          config: snapshot,
        };
      }
      const scopes = Array.isArray(payload?.scopes) && payload.scopes.length ? payload.scopes : config.scopes;
      const state = JSON.stringify({
        tenantId: String(payload?.tenantId || "").trim(),
        userId: String(payload?.userId || "").trim(),
        userEmail: String(payload?.userEmail || "").trim(),
        redirectTo: String(payload?.redirectTo || "").trim(),
      });
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", config.clientId);
      authUrl.searchParams.set("redirect_uri", config.redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("prompt", String(payload?.prompt || "consent").trim() || "consent");
      authUrl.searchParams.set("state", state);
      return {
        ok: true,
        source: "mock",
        provider: "google",
        authUrl: authUrl.toString(),
        state,
        redirectUri: config.redirectUri,
        scopes,
        config: snapshot,
      };
    },

    async completeGoogleCalendarOAuth(payload = {}) {
      const state = (() => {
        try {
          return JSON.parse(String(payload?.state || "{}"));
        } catch {
          return {};
        }
      })();
      return {
        ok: true,
        source: "mock",
        provider: "google",
        connection: {
          tenantId: String(state?.tenantId || "").trim(),
          userId: String(state?.userId || "").trim(),
          userEmail: String(state?.userEmail || "").trim(),
          redirectTo: String(state?.redirectTo || "").trim(),
          accessToken: "mock_access_token",
          refreshToken: "mock_refresh_token",
          expiresIn: 3600,
          scope: getGoogleCalendarConfig().scopes.join(" "),
          tokenType: "Bearer",
          calendarId: "primary",
          calendarName: "Calendario principal",
          connectedAt: new Date().toISOString(),
        },
      };
    },

    async saveUserGoogleCalendarConnection(userId, connection = {}) {
      const users = await loadUsers();
      const target = users.find(user => user.id === userId);
      if (!target) return null;
      const nextConnection = {
        connected: true,
        email: String(connection.userEmail || target.email || "").trim(),
        calendarId: String(connection.calendarId || "primary").trim(),
        calendarName: String(connection.calendarName || "Calendario principal").trim(),
        autoSync: connection.autoSync === true,
        lastSyncAt: String(connection.connectedAt || new Date().toISOString()).trim(),
        tokenType: String(connection.tokenType || "Bearer").trim(),
        scope: String(connection.scope || "").trim(),
      };
      const nextUser = {
        ...target,
        googleCalendar: nextConnection,
      };
      await saveUsers(users.map(user => user.id === userId ? nextUser : user));
      return nextUser;
    },

    async clearUserGoogleCalendarConnection(userId) {
      const users = await loadUsers();
      const target = users.find(user => user.id === userId);
      if (!target) return null;
      const nextUser = {
        ...target,
        googleCalendar: {
          connected: false,
          email: "",
          calendarId: "primary",
          calendarName: "Calendario principal",
          autoSync: false,
          lastSyncAt: "",
        },
      };
      await saveUsers(users.map(user => user.id === userId ? nextUser : user));
      return nextUser;
    },

    async listTenantCalendarConnections(tenantId = "") {
      const users = await loadUsers();
      return users
        .filter(user => !tenantId || user.empId === tenantId)
        .map(user => ({
          userId: user.id,
          tenantId: user.empId || "",
          userEmail: user.email || "",
          userName: user.name || "",
          ...(user.googleCalendar || {
            connected: false,
            email: "",
            calendarId: "primary",
            calendarName: "Calendario principal",
            autoSync: false,
            lastSyncAt: "",
          }),
        }));
    },

    async createGoogleCalendarEvent(payload = {}) {
      return {
        ok: true,
        source: "mock",
        provider: "google",
        event: {
          id: String(payload?.googleEventId || `gcal_mock_${Date.now()}`),
          calendarId: String(payload?.calendarId || "primary").trim(),
          summary: String(payload?.summary || "Evento Produ").trim(),
          description: String(payload?.description || "").trim(),
          startDateTime: String(payload?.startDateTime || "").trim(),
          endDateTime: String(payload?.endDateTime || "").trim(),
          timeZone: String(payload?.timeZone || "America/Santiago").trim(),
          createdAt: new Date().toISOString(),
        },
      };
    },

    async listGoogleCalendarEvents() {
      return {
        ok: true,
        source: "mock",
        provider: "google",
        items: [],
      };
    },

    async deleteGoogleCalendarEvent() {
      return {
        ok: true,
        source: "mock",
        provider: "google",
      };
    },
  };
}
