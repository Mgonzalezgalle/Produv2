import { appendOperationalAuditEntry } from "./operationalAudit";

export async function appendWorkflowEventEntry({
  empId = "",
  stream = "",
  eventName = "",
  entityType = "",
  entityId = "",
  actor = null,
  payload = null,
  platformServices = null,
} = {}) {
  const safeStream = String(stream || "").trim();
  const safeEventName = String(eventName || "").trim();
  if (!safeStream || !safeEventName) return { ok: false, source: "skipped" };
  return appendOperationalAuditEntry({
    empId,
    area: "workflow",
    action: safeEventName,
    entityType,
    entityId,
    actor,
    payload: {
      workflowStream: safeStream,
      workflowEvent: safeEventName,
      ...((payload && typeof payload === "object") ? payload : {}),
    },
    platformServices,
  });
}
