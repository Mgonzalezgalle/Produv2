import { createMockPlatformServices } from "./mockPlatformServices";
import { createAuthMockService } from "./authMockService";
import { createTenantBootstrapMockService } from "./tenantBootstrapMockService";
import {
  activateSelfServeTenantMockEndpoint,
  confirmSelfServePaymentMockEndpoint,
  createSelfServeCheckoutSessionMockEndpoint,
} from "../lab/selfServeMockApi";
import {
  createBsaleManualEmissionMockEndpoint,
  getBsaleDocumentStatusMockEndpoint,
} from "../lab/bsaleMockApi";

export function createPlatformMockGateway({
  dbGet,
  dbSet,
  sha256Hex,
  authGateway = null,
  sessionKey = "",
  users = [],
  empresas = [],
  nextTenantCode = null,
  today = null,
}) {
  const services = createMockPlatformServices({ dbGet, dbSet, sha256Hex });
  const authService = authGateway && sessionKey
    ? createAuthMockService({ sessionKey, authGateway, users, empresas })
    : null;
  const tenantBootstrapService = nextTenantCode && today
    ? createTenantBootstrapMockService({ dbGet, dbSet, nextTenantCode, today })
    : null;

  return {
    services,
    authService,
    tenantBootstrapService,

    async createPendingTenant(payload = {}) {
      if (!tenantBootstrapService) {
        throw new Error("tenantBootstrapService no está configurado en este gateway.");
      }
      return tenantBootstrapService.createPendingTenant(payload);
    },

    async createSelfServeCheckoutSession({ acquisitionLead = {}, pricingSnapshot } = {}) {
      return createSelfServeCheckoutSessionMockEndpoint({
        dbGet,
        dbSet,
        acquisitionLead,
        pricingSnapshot,
      });
    },

    async confirmSelfServePayment({ leadId = "", checkoutSessionId = "" } = {}) {
      return confirmSelfServePaymentMockEndpoint({
        dbGet,
        dbSet,
        leadId,
        checkoutSessionId,
      });
    },

    async activateSelfServeTenant({ leadId = "", checkoutSessionId = "" } = {}) {
      return activateSelfServeTenantMockEndpoint({
        dbGet,
        dbSet,
        services,
        leadId,
        checkoutSessionId,
      });
    },

    async emitBillingDocumentManual({
      factura = {},
      empresa = {},
      cliente = {},
      lineItems = [],
      references = [],
    } = {}) {
      return createBsaleManualEmissionMockEndpoint({
        dbGet,
        dbSet,
        factura,
        empresa,
        cliente,
        lineItems,
        references,
      });
    },

    async getBillingDocumentStatus({
      facturaId = "",
    } = {}) {
      return getBsaleDocumentStatusMockEndpoint({
        dbGet,
        dbSet,
        facturaId,
      });
    },

    async sendTransactionalEmail(payload = {}) {
      return services.sendTransactionalEmail(payload);
    },

    async listTransactionalEmailLogs({ tenantId = "" } = {}) {
      return services.listTransactionalEmailLogs({ tenantId });
    },

    async createMercadoPagoPaymentLink(payload = {}) {
      return services.createMercadoPagoPaymentLink(payload);
    },

    async handleMercadoPagoPayment(payload = {}) {
      return services.handleMercadoPagoPayment(payload);
    },

    async listMercadoPagoLogs({ tenantId = "", invoiceId = "" } = {}) {
      return services.listMercadoPagoLogs({ tenantId, invoiceId });
    },

    async startGoogleCalendarOAuth(payload = {}) {
      return services.startGoogleCalendarOAuth(payload);
    },

    async completeGoogleCalendarOAuth(payload = {}) {
      return services.completeGoogleCalendarOAuth(payload);
    },

    async createGoogleCalendarEvent(payload = {}) {
      return services.createGoogleCalendarEvent(payload);
    },

    async listGoogleCalendarEvents(payload = {}) {
      return services.listGoogleCalendarEvents(payload);
    },

    async deleteGoogleCalendarEvent(payload = {}) {
      return services.deleteGoogleCalendarEvent(payload);
    },
  };
}
