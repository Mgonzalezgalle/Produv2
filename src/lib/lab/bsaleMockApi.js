import { buildBsaleBillingApiContract, getBsaleBillingConfig } from "../integrations/bsaleBilling";
import { buildBsaleInvoiceSyncDraft } from "../integrations/bsaleBillingMapper";

export const BSALE_EMISSION_STORE_KEY = "produ:bsaleEmissionSessions";

export async function loadBsaleEmissionSessions(dbGet) {
  return (await dbGet(BSALE_EMISSION_STORE_KEY)) || [];
}

export async function saveBsaleEmissionSessions(dbSet, sessions = []) {
  await dbSet(BSALE_EMISSION_STORE_KEY, sessions);
  return sessions;
}

export async function createBsaleManualEmissionMockEndpoint({
  dbGet,
  dbSet,
  factura = {},
  empresa = {},
  cliente = {},
  lineItems = [],
  references = [],
} = {}) {
  const config = getBsaleBillingConfig();
  const syncDraft = buildBsaleInvoiceSyncDraft({
    factura,
    empresa,
    cliente,
    lineItems,
    references,
    config,
  });

  const sessionId = `bsale_emit_${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const record = {
    id: sessionId,
    provider: "bsale",
    mode: "manual",
    status: "draft",
    facturaId: factura?.id || "",
    empId: empresa?.id || factura?.empId || "",
    request: syncDraft.request,
    syncDraft,
    contract: buildBsaleBillingApiContract(),
    createdAt: now,
    updatedAt: now,
  };

  const currentSessions = await loadBsaleEmissionSessions(dbGet);
  await saveBsaleEmissionSessions(dbSet, [...currentSessions, record]);

  return {
    ok: true,
    sessionRecord: record,
    facturaPatch: {
      externalSync: {
        provider: "bsale",
        mode: "manual",
        status: "draft",
        source: "mock",
        sessionId,
        requestedAt: now,
      },
    },
  };
}

export async function getBsaleDocumentStatusMockEndpoint({
  dbGet,
  dbSet,
  facturaId = "",
} = {}) {
  const sessions = await loadBsaleEmissionSessions(dbGet);
  const target = sessions
    .filter(session => session.facturaId === facturaId)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];

  if (!target) {
    return {
      ok: false,
      error: "No existe una sesión Bsale para este documento.",
    };
  }

  const now = new Date().toISOString();
  const nextRecord = {
    ...target,
    status: "synced",
    updatedAt: now,
    externalDocumentId: target.externalDocumentId || `bsale_doc_${target.id.slice(-8)}`,
    externalFolio: target.externalFolio || Math.floor(1000 + Math.random() * 9000),
    providerStatus: "accepted",
  };
  const nextSessions = sessions.map(session => session.id === target.id ? nextRecord : session);
  await saveBsaleEmissionSessions(dbSet, nextSessions);

  return {
    ok: true,
    sessionRecord: nextRecord,
    externalSync: {
      provider: "bsale",
      mode: "manual",
      status: "synced",
      source: "mock",
      sessionId: nextRecord.id,
      requestedAt: target.createdAt,
      syncedAt: now,
      externalDocumentId: nextRecord.externalDocumentId,
      externalFolio: nextRecord.externalFolio,
      providerStatus: nextRecord.providerStatus,
    },
  };
}
