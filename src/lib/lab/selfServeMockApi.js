import { createSelfServeFintocSession } from "../integrations/fintocCheckout";
import {
  buildSelfServeActivationState,
  markSelfServeActivated,
  markSelfServeCheckoutCreated,
  markSelfServePaymentSucceeded,
} from "../integrations/selfServeActivation";
import { normalizeEmpresasModel } from "../utils/helpers";

export const SELF_SERVE_CHECKOUT_STORE_KEY = "produ:selfServeCheckoutSessions";
export const SELF_SERVE_LEADS_STORE_KEY = "produ:solicitudes";

export async function loadSelfServeCheckoutSessions(dbGet) {
  return (await dbGet(SELF_SERVE_CHECKOUT_STORE_KEY)) || [];
}

export async function saveSelfServeCheckoutSessions(dbSet, sessions = []) {
  await dbSet(SELF_SERVE_CHECKOUT_STORE_KEY, sessions);
  return sessions;
}

export async function loadSelfServeLeads(dbGet) {
  return (await dbGet(SELF_SERVE_LEADS_STORE_KEY)) || [];
}

export async function saveSelfServeLeads(dbSet, leads = []) {
  await dbSet(SELF_SERVE_LEADS_STORE_KEY, leads);
  return leads;
}

export async function createSelfServeCheckoutSessionMockEndpoint({
  dbGet,
  dbSet,
  acquisitionLead = {},
  pricingSnapshot = acquisitionLead?.pricingSnapshot,
} = {}) {
  const session = await createSelfServeFintocSession({
    acquisitionLead,
    pricingSnapshot,
    mode: "mock",
  });

  if (!session?.ok) {
    return {
      ok: false,
      error: session?.error || "No pudimos crear la sesión mock de checkout.",
      validation: session?.validation || null,
      request: session?.request || null,
    };
  }

  const activation = markSelfServeCheckoutCreated(
    buildSelfServeActivationState({
      checkoutState: "draft",
      paymentState: "draft",
      activationState: acquisitionLead?.activationState || "awaiting_review",
      provider: "fintoc",
    }),
    session,
  );

  const record = {
    id: session.sessionId,
    provider: "fintoc",
    acquisitionLeadId: acquisitionLead?.id || "",
    companyDraftId: acquisitionLead?.companyDraft?.id || acquisitionLead?.empresaId || "",
    request: session.request,
    session,
    activation,
    createdAt: session.createdAt,
    updatedAt: session.createdAt,
  };

  const currentSessions = await loadSelfServeCheckoutSessions(dbGet);
  await saveSelfServeCheckoutSessions(dbSet, [...currentSessions, record]);

  return {
    ok: true,
    sessionRecord: record,
    leadPatch: {
      checkoutDraft: session.request,
      checkoutSession: session,
      checkoutState: activation.checkoutState,
      paymentState: activation.paymentState,
      activationState: activation.activationState,
      activationFlow: activation,
    },
  };
}

export async function confirmSelfServePaymentMockEndpoint({
  dbGet,
  dbSet,
  leadId = "",
  checkoutSessionId = "",
} = {}) {
  const sessions = await loadSelfServeCheckoutSessions(dbGet);
  const target = sessions.find(session =>
    (checkoutSessionId && session.id === checkoutSessionId)
    || (leadId && session.acquisitionLeadId === leadId),
  );
  if (!target) {
    return { ok: false, error: "No encontramos la sesión de checkout." };
  }

  const nextActivation = markSelfServePaymentSucceeded(target.activation, {
    leadId: target.acquisitionLeadId,
    checkoutSessionId: target.id,
  });
  const nextSessions = sessions.map(session => session.id === target.id ? {
    ...session,
    activation: nextActivation,
    updatedAt: new Date().toISOString(),
    session: {
      ...session.session,
      status: "paid",
    },
  } : session);
  await saveSelfServeCheckoutSessions(dbSet, nextSessions);

  const leads = await loadSelfServeLeads(dbGet);
  const nextLeads = leads.map(lead => lead.id === target.acquisitionLeadId ? {
    ...lead,
    paymentState: nextActivation.paymentState,
    activationState: nextActivation.activationState,
    checkoutState: nextActivation.checkoutState,
    activationFlow: nextActivation,
    checkoutSession: {
      ...(lead.checkoutSession || {}),
      status: "paid",
    },
    estado: "payment_confirmed",
  } : lead);
  await saveSelfServeLeads(dbSet, nextLeads);

  return {
    ok: true,
    sessionRecord: nextSessions.find(session => session.id === target.id) || null,
    lead: nextLeads.find(lead => lead.id === target.acquisitionLeadId) || null,
  };
}

export async function activateSelfServeTenantMockEndpoint({
  dbGet,
  dbSet,
  services,
  leadId = "",
  checkoutSessionId = "",
} = {}) {
  const leads = await loadSelfServeLeads(dbGet);
  const lead = leads.find(item =>
    (leadId && item.id === leadId)
    || (checkoutSessionId && item.checkoutSession?.sessionId === checkoutSessionId),
  );
  if (!lead) {
    return { ok: false, error: "No encontramos el lead de activación." };
  }
  if (lead.paymentState !== "payment_confirmed") {
    return { ok: false, error: "El pago todavía no está confirmado." };
  }

  const empresas = normalizeEmpresasModel((await dbGet("produ:empresas")) || []);
  const tenant = empresas.find(item => item.id === lead.empresaId);
  if (!tenant) {
    return { ok: false, error: "No encontramos la empresa pendiente." };
  }

  const requestedModules = Array.isArray(lead.requestedModules) ? lead.requestedModules : [];
  const nextTenant = {
    ...tenant,
    active: true,
    pendingActivation: false,
    addons: requestedModules,
    requestedModules,
    activatedAt: new Date().toISOString(),
    activationSource: "self_serve_mock",
  };
  await dbSet("produ:empresas", empresas.map(item => item.id === tenant.id ? nextTenant : item));

  let adminUser = null;
  if (services?.listTenantUsers && services?.createTenantUser) {
    const tenantUsers = await services.listTenantUsers(tenant.id);
    const adminEmail = String(lead.adminDraft?.email || "").trim().toLowerCase();
    adminUser = tenantUsers.find(user => String(user.email || "").trim().toLowerCase() === adminEmail) || null;
    if (!adminUser && adminEmail) {
      adminUser = await services.createTenantUser({
        tenantId: tenant.id,
        name: `${lead.adminDraft?.firstName || ""} ${lead.adminDraft?.lastName || ""}`.trim() || "Administrador",
        email: adminEmail,
        role: lead.adminDraft?.role || "admin",
        active: true,
      });
    }
  }

  const sessions = await loadSelfServeCheckoutSessions(dbGet);
  const targetSession = sessions.find(session =>
    session.acquisitionLeadId === lead.id
    || (checkoutSessionId && session.id === checkoutSessionId),
  );
  const nextActivation = markSelfServeActivated(targetSession?.activation || lead.activationFlow || {}, {
    tenantId: tenant.id,
    adminUserId: adminUser?.id || "",
  });
  const nextSessions = sessions.map(session => session.id === targetSession?.id ? {
    ...session,
    activation: nextActivation,
    updatedAt: new Date().toISOString(),
  } : session);
  await saveSelfServeCheckoutSessions(dbSet, nextSessions);

  const nextLeads = leads.map(item => item.id === lead.id ? {
    ...item,
    estado: "activated",
    activationState: nextActivation.activationState,
    activationFlow: nextActivation,
  } : item);
  await saveSelfServeLeads(dbSet, nextLeads);

  return {
    ok: true,
    tenant: nextTenant,
    adminUser,
    lead: nextLeads.find(item => item.id === lead.id) || null,
    sessionRecord: nextSessions.find(session => session.id === targetSession?.id) || null,
  };
}
