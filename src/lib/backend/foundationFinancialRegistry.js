import { appendOperationalAuditEntry } from "../operations/operationalAudit";
import { appendWorkflowEventEntry } from "../operations/workflowEvents";

export function createFoundationFinancialRegistryCoordinator({
  empId = "",
  platformServices = null,
  actor = null,
} = {}) {
  const safeEmpId = String(empId || "").trim();

  const recordEvent = async (registryName = "", action = "", payload = {}) => {
    if (!safeEmpId || !registryName || !action) return null;
    return appendOperationalAuditEntry({
      empId: safeEmpId,
      area: "foundation",
      action,
      entityType: "financial_registry",
      entityId: registryName,
      actor,
      payload: {
        registryName,
        ...payload,
      },
      platformServices,
    });
  };

  const rehydrateSnapshot = async ({
    registryName = "",
    hydratedRef = null,
    currentRecords = [],
    setRecords = null,
    sanitizeRecord = (item => item),
    isValidRecord = (item => Boolean(item)),
    mergeRecords = ((_current = [], next = []) => next),
    failureMessage = "No pudimos rehidratar registros desde foundation.",
  } = {}) => {
    if (!safeEmpId || !registryName || !platformServices?.getFinancialRegistrySnapshot) {
      return { ok: false, source: "skipped", records: [] };
    }
    if (hydratedRef?.current === safeEmpId) {
      return { ok: false, source: "already_hydrated", records: [] };
    }
    if (Array.isArray(currentRecords) && currentRecords.length) {
      if (hydratedRef) hydratedRef.current = safeEmpId;
      return { ok: false, source: "local_present", records: currentRecords };
    }
    try {
      const snapshot = await platformServices.getFinancialRegistrySnapshot(safeEmpId, registryName);
      const records = Array.isArray(snapshot?.records)
        ? snapshot.records
          .map(item => sanitizeRecord(item, safeEmpId))
          .filter(item => isValidRecord(item))
        : [];
      if (!records.length) {
        return { ok: false, source: snapshot?.source || "remote_empty", records: [] };
      }
      if (hydratedRef) hydratedRef.current = safeEmpId;
      await recordEvent(registryName, "registry_rehydrated", {
        recordCount: records.length,
        source: snapshot?.source || "remote",
      });
      await Promise.resolve(setRecords?.(mergeRecords([], records))).catch(() => null);
      return { ok: true, source: snapshot?.source || "remote", records };
    } catch (error) {
      await recordEvent(registryName, "registry_rehydrate_failed", {
        message: error?.message || failureMessage,
      });
      return { ok: false, source: "failed", records: [], error };
    }
  };

  const syncSnapshot = async ({
    registryName = "",
    records = [],
    metadata = {},
    degradedMessage = "No pudimos sincronizar registros con foundation.",
  } = {}) => {
    if (!safeEmpId || !registryName || !platformServices?.upsertFinancialRegistrySnapshot) {
      return { ok: false, source: "skipped", records };
    }
    try {
      const syncResult = await platformServices.upsertFinancialRegistrySnapshot(safeEmpId, registryName, records, metadata);
      await recordEvent(registryName, "registry_snapshot_synced", {
        recordCount: Array.isArray(records) ? records.length : 0,
        source: syncResult?.source || "remote",
      });
      return { ok: true, source: syncResult?.source || "remote", records };
    } catch (error) {
      await recordEvent(registryName, "registry_snapshot_degraded", {
        recordCount: Array.isArray(records) ? records.length : 0,
        message: error?.message || degradedMessage,
      });
      return { ok: false, source: "degraded", records, error };
    }
  };

  const mutateSnapshot = async ({
    registryName = "",
    setRecords = null,
    mutateRecords = (current => current),
    metadata = {},
    degradedMessage = "No pudimos sincronizar registros con foundation.",
    audit = null,
    workflow = null,
  } = {}) => {
    if (!safeEmpId || !registryName || typeof setRecords !== "function") {
      return { ok: false, source: "skipped", records: [] };
    }
    let updatedRecords = [];
    await Promise.resolve(setRecords((current = []) => {
      const baseRecords = Array.isArray(current) ? current : [];
      const nextRecords = mutateRecords(baseRecords);
      updatedRecords = Array.isArray(nextRecords) ? nextRecords : baseRecords;
      return updatedRecords;
    }));
    const syncResult = await syncSnapshot({
      registryName,
      records: updatedRecords,
      metadata,
      degradedMessage,
    });
    if (audit?.action) {
      await appendOperationalAuditEntry({
        empId: safeEmpId,
        area: audit.area || "operacion",
        action: audit.action,
        entityType: audit.entityType || registryName,
        entityId: audit.entityId || "",
        actor,
        payload: audit.payload && typeof audit.payload === "object" ? audit.payload : {},
        platformServices,
      });
    }
    if (workflow?.stream && workflow?.eventName) {
      await appendWorkflowEventEntry({
        empId: safeEmpId,
        stream: workflow.stream,
        eventName: workflow.eventName,
        entityType: workflow.entityType || audit?.entityType || registryName,
        entityId: workflow.entityId || audit?.entityId || "",
        actor,
        payload: workflow.payload && typeof workflow.payload === "object" ? workflow.payload : {},
        platformServices,
      });
    }
    return {
      ok: true,
      source: syncResult?.source || "local",
      records: updatedRecords,
      syncResult,
    };
  };

  return {
    recordEvent,
    rehydrateSnapshot,
    syncSnapshot,
    mutateSnapshot,
  };
}
