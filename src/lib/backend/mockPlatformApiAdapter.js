export function createMockPlatformApiAdapter({
  authService = null,
  authGateway = null,
  users = [],
  tenantBootstrapService = null,
  platformGateway = null,
}) {
  return {
    auth: {
      async loginWithPassword({ email, password }) {
        if (!authService) throw new Error("authService no está configurado.");
        return authService.loginWithPassword({ email, password });
      },

      async restoreSession() {
        if (!authService) throw new Error("authService no está configurado.");
        return authService.restoreSession();
      },

      async logout() {
        if (!authService) throw new Error("authService no está configurado.");
        await authService.clearSession();
        return { ok: true };
      },

      async requestPasswordReset({ email }) {
        if (!authGateway?.requestPasswordReset) {
          return { ok: false, message: "Password reset no disponible." };
        }
        return authGateway.requestPasswordReset({ users, email });
      },
    },

    tenants: {
      async createPendingTenant(payload = {}) {
        if (!tenantBootstrapService) throw new Error("tenantBootstrapService no está configurado.");
        const tenantDraft = await tenantBootstrapService.createPendingTenant(payload);
        return { tenantDraft };
      },

      async activatePendingTenant({ leadId = "", checkoutSessionId = "" } = {}) {
        if (!platformGateway?.activateSelfServeTenant) {
          throw new Error("activateSelfServeTenant no está configurado.");
        }
        return platformGateway.activateSelfServeTenant({ leadId, checkoutSessionId });
      },
    },

    checkout: {
      async confirmPayment({ leadId = "", checkoutSessionId = "" } = {}) {
        if (!platformGateway?.confirmSelfServePayment) {
          throw new Error("confirmSelfServePayment no está configurado.");
        }
        return platformGateway.confirmSelfServePayment({ leadId, checkoutSessionId });
      },
    },

    billing: {
      async getDocumentStatus({ documentId = "" } = {}) {
        if (!platformGateway?.getBillingDocumentStatus) {
          throw new Error("getBillingDocumentStatus no está configurado.");
        }
        return platformGateway.getBillingDocumentStatus({ facturaId: documentId });
      },
    },

    notifications: {
      async sendTransactionalEmail(payload = {}) {
        if (!platformGateway?.sendTransactionalEmail) {
          throw new Error("sendTransactionalEmail no está configurado.");
        }
        return platformGateway.sendTransactionalEmail(payload);
      },

      async listTransactionalEmailLogs({ tenantId = "" } = {}) {
        if (!platformGateway?.listTransactionalEmailLogs) {
          throw new Error("listTransactionalEmailLogs no está configurado.");
        }
        return platformGateway.listTransactionalEmailLogs({ tenantId });
      },
    },

    payments: {
      async createMercadoPagoPaymentLink(payload = {}) {
        if (!platformGateway?.createMercadoPagoPaymentLink) {
          throw new Error("createMercadoPagoPaymentLink no está configurado.");
        }
        return platformGateway.createMercadoPagoPaymentLink(payload);
      },

      async handleMercadoPagoPayment(payload = {}) {
        if (!platformGateway?.handleMercadoPagoPayment) {
          throw new Error("handleMercadoPagoPayment no está configurado.");
        }
        return platformGateway.handleMercadoPagoPayment(payload);
      },

      async listMercadoPagoLogs({ tenantId = "", invoiceId = "" } = {}) {
        if (!platformGateway?.listMercadoPagoLogs) {
          throw new Error("listMercadoPagoLogs no está configurado.");
        }
        return platformGateway.listMercadoPagoLogs({ tenantId, invoiceId });
      },
    },

    calendar: {
      async startGoogleCalendarOAuth(payload = {}) {
        if (!platformGateway?.startGoogleCalendarOAuth) {
          throw new Error("startGoogleCalendarOAuth no está configurado.");
        }
        return platformGateway.startGoogleCalendarOAuth(payload);
      },

      async completeGoogleCalendarOAuth(payload = {}) {
        if (!platformGateway?.completeGoogleCalendarOAuth) {
          throw new Error("completeGoogleCalendarOAuth no está configurado.");
        }
        return platformGateway.completeGoogleCalendarOAuth(payload);
      },

      async createGoogleCalendarEvent(payload = {}) {
        if (!platformGateway?.createGoogleCalendarEvent) {
          throw new Error("createGoogleCalendarEvent no está configurado.");
        }
        return platformGateway.createGoogleCalendarEvent(payload);
      },

      async listGoogleCalendarEvents(payload = {}) {
        if (!platformGateway?.listGoogleCalendarEvents) {
          throw new Error("listGoogleCalendarEvents no está configurado.");
        }
        return platformGateway.listGoogleCalendarEvents(payload);
      },

      async deleteGoogleCalendarEvent(payload = {}) {
        if (!platformGateway?.deleteGoogleCalendarEvent) {
          throw new Error("deleteGoogleCalendarEvent no está configurado.");
        }
        return platformGateway.deleteGoogleCalendarEvent(payload);
      },
    },
  };
}
